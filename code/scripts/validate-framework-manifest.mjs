#!/usr/bin/env node
// Three-way consistency check for the external framework layer:
//   manifest declaration == configuration-registry declaration == installed version
//
// The registry and the run records used to hold the same hardcoded literal, so
// `validateRunRecordAgainstRegistry()` compared a value with itself and could
// never fail. This validator makes the registry accountable to the manifest, and
// the readiness gate makes the manifest accountable to what is installed.
import fs from 'node:fs';
import path from 'node:path';
import { loadFrameworkManifest } from '../src/framework-version.mjs';
import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';
import { FRAMEWORK_VARIANTS } from '../src/framework-variants.mjs';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const repositoryRoot = path.resolve(codeRoot, '..');
const errors = [];
const warnings = [];

const manifest = loadFrameworkManifest();
const registry = loadConfigurationRegistry();

// --- manifest internal consistency -----------------------------------------
const seen = new Set();
for (const environment of manifest.environments ?? []) {
  if (seen.has(environment.environment_id)) errors.push(`duplicate environment_id: ${environment.environment_id}`);
  seen.add(environment.environment_id);
  if (!['historical', 'latest'].includes(environment.track)) errors.push(`${environment.environment_id}: unsupported track ${environment.track}`);
  if (!['uv', 'npm'].includes(environment.manager)) errors.push(`${environment.environment_id}: unsupported manager ${environment.manager}`);
  if (!['installed', 'failed', 'pending', 'collapsed-to-historical'].includes(environment.install_status)) {
    errors.push(`${environment.environment_id}: unsupported install_status ${environment.install_status}`);
  }
  if (environment.install_status === 'installed' && !environment.resolved?.version) {
    errors.push(`${environment.environment_id}: install_status is installed but no resolved version is recorded`);
  }
  if (environment.lock_file) {
    const lockPath = path.join(repositoryRoot, environment.lock_file);
    if (!fs.existsSync(lockPath)) errors.push(`${environment.environment_id}: lock file is missing: ${environment.lock_file}`);
  }
}

// --- registry <-> manifest --------------------------------------------------
const manifestByFramework = new Map();
for (const environment of manifest.environments ?? []) {
  if (!manifestByFramework.has(environment.framework_id)) manifestByFramework.set(environment.framework_id, []);
  manifestByFramework.get(environment.framework_id).push(environment);
}

const coveredFrameworks = new Set();
for (const configuration of registry.configurations) {
  const frameworkId = configuration.framework?.id;
  if (!frameworkId) continue;
  coveredFrameworks.add(frameworkId);
  const environments = manifestByFramework.get(frameworkId) ?? [];
  if (environments.length === 0) {
    // Native drivers (pss-native) and the scripted Playwright baseline are not
    // external environments; only flag a framework that claims an external id.
    if (['pss-native', 'playwright'].includes(frameworkId)) continue;
    warnings.push(`registry configuration ${configuration.configuration_id} uses framework ${frameworkId} which has no manifest environment`);
    continue;
  }
  const historical = environments.find((environment) => environment.track === 'historical');
  const declared = historical?.resolved?.version ?? null;
  if (declared === null) {
    errors.push(`registry configuration ${configuration.configuration_id}: manifest has no resolved historical version for ${frameworkId}`);
    continue;
  }
  if (configuration.framework.version !== declared) {
    // A legacy-pilot configuration legitimately records the version its
    // historical ledgers were written with, and must not be rewritten. It is
    // reported so the deviation stays visible, but it is not an executable
    // configuration for new collection.
    if (['legacy-pilot', 'retired'].includes(configuration.status)) {
      warnings.push(`registry configuration ${configuration.configuration_id} declares ${frameworkId}@${configuration.framework.version} (historical); the manifest declares ${declared}`);
    } else {
      errors.push(`registry configuration ${configuration.configuration_id} declares ${frameworkId}@${configuration.framework.version} but the manifest declares ${declared}`);
    }
  }
}

// --- scripted baseline: the executable configuration must match what runs ---
// The same defect class as F-01 also affected the scripted comparator arm: the
// registry declared Playwright 1.55 while the installed and locked version was
// 1.62.1, and because both sides of the comparison held "1.55" the run-record
// cross-check could not notice. An executable scripted configuration must now
// declare the installed version. A legacy-pilot entry may keep its historical
// declaration, but it is reported so the deviation is visible.
const playwrightEnvironment = (manifest.environments ?? []).find((environment) => environment.framework_id === 'playwright');
if (playwrightEnvironment?.resolved?.version) {
  const installedPlaywright = playwrightEnvironment.resolved.version;
  for (const configuration of registry.configurations) {
    if (configuration.family !== 'scripted') continue;
    const declared = configuration.framework?.version;
    if (configuration.status === 'implemented' && declared !== installedPlaywright) {
      errors.push(`scripted configuration ${configuration.configuration_id} declares playwright@${declared} but ${installedPlaywright} is installed`);
    }
    if (configuration.status === 'legacy-pilot' && declared !== installedPlaywright) {
      warnings.push(`scripted configuration ${configuration.configuration_id} declares playwright@${declared} (historical); ${installedPlaywright} is installed. Historical ledgers keep the declaration they were written with.`);
    }
  }
}

// --- framework variant vocabulary ------------------------------------------
const variantIds = new Set(FRAMEWORK_VARIANTS.map((variant) => variant.id));
for (const frameworkId of coveredFrameworks) {
  const normalised = frameworkId.replace(/-grounded$|-cua$/, '');
  if (['pss-native', 'playwright'].includes(frameworkId)) continue;
  if (!variantIds.has(normalised) && !variantIds.has(frameworkId)) {
    warnings.push(`registry framework id ${frameworkId} does not match any FRAMEWORK_VARIANTS id (${[...variantIds].join(', ')})`);
  }
}

if (warnings.length > 0) for (const warning of warnings) console.error(`warning: ${warning}`);
if (errors.length > 0) {
  console.error(`Framework manifest validation failed:\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  const installed = (manifest.environments ?? []).filter((environment) => environment.install_status === 'installed').length;
  const collapsed = (manifest.environments ?? []).filter((environment) => environment.install_status === 'collapsed-to-historical').length;
  console.log(`Framework manifest validation passed: ${manifest.environments.length} environments (${installed} installed, ${collapsed} collapsed-to-historical); registry frameworks cross-checked: ${coveredFrameworks.size}`);
}
