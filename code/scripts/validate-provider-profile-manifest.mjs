#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
// Validates the frozen provider-profile manifest and reports how much of the
// configuration registry is covered by a frozen protocol profile.
import fs from 'node:fs';
import path from 'node:path';
import { loadProviderProfileManifest, providerProfileManifestPath, validateProviderProfileManifest } from '../src/provider-profile.mjs';
import { loadAgentOptimizationProfiles } from '../src/agent-optimization.mjs';
import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';

const codeRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const registryPath = path.join(codeRoot, 'config', 'configuration-registry.v0.2.json');

const manifest = loadProviderProfileManifest();
const result = validateProviderProfileManifest(manifest);
const errors = [...result.errors];

const optimization = loadAgentOptimizationProfiles();
const optimizationIds = new Set(optimization.profiles.map((profile) => profile.id));
for (const profile of manifest.profiles ?? []) {
  if (profile.optimization_profile && !optimizationIds.has(profile.optimization_profile)) {
    errors.push(`profile ${profile.profile_id} references unknown optimization profile: ${profile.optimization_profile}`);
  }
}

let registryCoverage = { executable: 0, covered: 0, uncovered: [] };
try {
  const registry = loadConfigurationRegistry(registryPath);
  // The scripted family is a deterministic Playwright baseline with no
  // provider/model, so it is out of scope for provider-protocol freezing.
  const executable = registry.configurations.filter((configuration) => ['implemented', 'admitted'].includes(configuration.status) && configuration.family !== 'scripted');
  const coveredModels = new Set((manifest.profiles ?? []).map((profile) => profile.model_id));
  const uncovered = executable.filter((configuration) => !coveredModels.has(configuration.runtime?.model_id)).map((configuration) => configuration.configuration_id);
  registryCoverage = { executable: executable.length, covered: executable.length - uncovered.length, uncovered };
  if (uncovered.length > 0) {
    console.error(`warning: ${uncovered.length} executable configuration(s) have no frozen provider profile: ${uncovered.join(', ')}`);
  }
} catch (error) {
  errors.push(`could not cross-check the configuration registry: ${error.message}`);
}

if (errors.length > 0) {
  console.error(`Provider profile manifest validation failed:\n- ${errors.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`Provider profile manifest validation passed: ${result.profile_count} frozen profiles; executable registry coverage ${registryCoverage.covered}/${registryCoverage.executable}; manifest ${path.relative(codeRoot, providerProfileManifestPath)}`);
}
