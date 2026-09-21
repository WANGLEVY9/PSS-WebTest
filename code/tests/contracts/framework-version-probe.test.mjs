import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  FrameworkEnvironmentMissingError,
  FrameworkVersionMismatchError,
  assertFrameworkVersion,
  assertRegistryAgreesWithManifest,
  loadFrameworkManifest,
  probeNodeFrameworkVersion,
  resolveFrameworkVersion
} from '../../src/framework-version.mjs';

const codeRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const manifest = loadFrameworkManifest();

test('the manifest declares both tracks and never pools them', () => {
  assert.equal(manifest.tracks.historical.pooling, 'never-pooled');
  assert.equal(manifest.tracks.latest.pooling, 'never-pooled');
  assert.ok(manifest.environments.length >= 6);
});

test('the npm probe reads the installed version rather than a literal', () => {
  const probe = probeNodeFrameworkVersion({ frameworkId: 'stagehand-grounded', track: 'historical', manifest });
  assert.equal(probe.ok, true, probe.detail);
  assert.match(probe.version, /^\d+\.\d+\.\d+/);
  assert.match(probe.source, /node_modules\/@browserbasehq\/stagehand\/package\.json$/);
});

test('a version mismatch fails closed instead of being written to a record', () => {
  assert.throws(
    () => assertFrameworkVersion({ frameworkId: 'stagehand-grounded', track: 'latest', installed: '3.0.8', manifest }),
    FrameworkVersionMismatchError
  );
});

test('a missing installed version is refused rather than guessed', () => {
  assert.throws(
    () => assertFrameworkVersion({ frameworkId: 'stagehand-grounded', track: 'historical', installed: null, manifest }),
    FrameworkVersionMismatchError
  );
});

test('a collapsed latest track is not an installable environment', () => {
  const collapsed = manifest.environments.filter((environment) => environment.install_status === 'collapsed-to-historical');
  assert.ok(collapsed.length >= 1, 'expected at least one collapsed latest-track environment');
  for (const environment of collapsed) {
    assert.equal(environment.track, 'latest');
    assert.equal(environment.track_equivalence.collapsed, true);
    assert.throws(
      () => assertFrameworkVersion({ frameworkId: environment.framework_id, track: environment.track, installed: environment.track_equivalence.version, manifest }),
      FrameworkEnvironmentMissingError
    );
  }
});

test('an unknown framework environment is refused', () => {
  assert.throws(() => resolveFrameworkVersion({ frameworkId: 'no-such-framework', track: 'historical', manifest }), FrameworkEnvironmentMissingError);
});

test('the registry version must equal the manifest declaration', () => {
  const historical = manifest.environments.find((environment) => environment.framework_id === 'stagehand-grounded' && environment.track === 'historical');
  const agreement = assertRegistryAgreesWithManifest({
    registryFrameworkId: 'stagehand-grounded',
    registryVersion: historical.resolved.version,
    frameworkId: 'stagehand-grounded',
    track: 'historical',
    manifest
  });
  assert.equal(agreement.declared_version, historical.resolved.version);
  assert.throws(
    () => assertRegistryAgreesWithManifest({ registryFrameworkId: 'stagehand-grounded', registryVersion: '9.9.9', frameworkId: 'stagehand-grounded', track: 'historical', manifest }),
    FrameworkVersionMismatchError
  );
});

test('no framework runner reintroduces a hardcoded framework version literal', () => {
  // Regression guard for the defect this module fixes: the version used to be a
  // string literal in five places, which made the registry cross-check vacuous.
  const guarded = [
    'scripts/framework-browser-use-runner.py',
    'scripts/framework-browser-use-smoke.py',
    'scripts/run-browser-use-bookstack-v02.mjs',
    'scripts/run-stagehand-bookstack-v02.mjs',
    'scripts/run-agentlab-bookstack-adapter.py'
  ];
  const literal = /framework_version["'\s:]+["']\d+\.\d+\.\d+/;
  for (const relative of guarded) {
    const source = fs.readFileSync(path.join(codeRoot, relative), 'utf8');
    const match = source.match(literal);
    assert.equal(match, null, `${relative} still hardcodes a framework version literal: ${match?.[0]}`);
  }
});

test('the executable scripted configuration declares the installed Playwright version', () => {
  // The same defect class as the hardcoded literals also affected the primary
  // comparator arm: the registry declared Playwright 1.55 while the installed
  // and locked version was 1.62.1, and because both sides of the comparison
  // held "1.55" the run-record cross-check could not notice.
  const playwrightEnvironment = manifest.environments.find((environment) => environment.framework_id === 'playwright');
  assert.ok(playwrightEnvironment, 'Playwright must be registered in the framework manifest');
  const installed = playwrightEnvironment.resolved?.version;
  assert.ok(installed, 'the Playwright environment must have a resolved version');
  const registry = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config', 'configuration-registry.v0.2.json'), 'utf8'));
  for (const configuration of registry.configurations) {
    if (configuration.family !== 'scripted' || configuration.status !== 'implemented') continue;
    assert.equal(configuration.framework.version, installed, `${configuration.configuration_id} must declare the installed Playwright ${installed}`);
  }
});

test('the configuration registry carries no placeholder framework versions', () => {
  const registryPath = path.join(codeRoot, 'config', 'configuration-registry.v0.2.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const placeholders = registry.configurations.filter((configuration) => /pending|tbd|external-adapter/i.test(String(configuration.framework?.version ?? '')));
  assert.deepEqual(placeholders.map((configuration) => configuration.configuration_id), []);
});
