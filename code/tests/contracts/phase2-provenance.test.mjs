import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { createPhase2Provenance, imageDigestFromTaskManifest, sha256 } from '../../src/phase2-provenance.mjs';
import { loadConfigurationRegistry } from '../../src/configuration-registry.mjs';

const codeRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const registry = loadConfigurationRegistry();
const runManifestPath = path.join(codeRoot, 'config/bookstack-navigation-run-manifest.v0.2.json');
const taskManifestPath = path.join(codeRoot, 'manifests/task-manifest.v0.1.json');

test('builds complete non-secret provenance for an implemented visual configuration', () => {
  const result = createPhase2Provenance({
    registry,
    configurationId: 'visual-pss-native-aliyun-qwen3-vl-flash-v2',
    runManifestPath,
    taskManifestPath,
    applicationId: 'bookstack',
    resetDigest: 'a'.repeat(64),
    randomizationBlock: 'bookstack-navigation-clean-r01',
    environment: { browser: 'chromium', browser_channel: 'bundled', viewport: '1280x720', runner: 'bookstack-agent-pilot-v2' }
  });
  assert.equal(result.schema_version, '0.2');
  assert.equal(result.strategy_family, 'visual');
  assert.equal(result.provenance.provider_id, 'aliyun-compatible');
  assert.match(result.run_manifest_digest, /^[a-f0-9]{64}$/);
  assert.equal(result.sut_image_digest, imageDigestFromTaskManifest({ taskManifestPath, applicationId: 'bookstack' }));
  assert.equal(result.provenance.environment_digest, sha256({ browser: 'chromium', browser_channel: 'bundled', viewport: '1280x720', runner: 'bookstack-agent-pilot-v2' }));
});

test('builds null provider fields for a scripted configuration and rejects secrets in environment input', () => {
  const options = {
    registry,
    configurationId: 'scripted-playwright-accessibility-human-v2',
    runManifestPath,
    taskManifestPath,
    applicationId: 'bookstack',
    resetDigest: 'b'.repeat(64),
    randomizationBlock: 'bookstack-navigation-clean-r01',
    environment: { browser: 'chromium', runner: 'bookstack-playwright-v2' }
  };
  const result = createPhase2Provenance(options);
  assert.equal(result.strategy_family, 'scripted');
  assert.equal(result.provenance.provider_id, null);
  assert.equal(result.provenance.code_framework, 'playwright-accessibility-locator');
  assert.throws(() => createPhase2Provenance({ ...options, environment: { api_key: 'must-not-enter-ledger' } }), /environment key/);
});

test('extracts a digest from an image@sha256 reference', () => {
  assert.match(imageDigestFromTaskManifest({ taskManifestPath, applicationId: 'juice-shop' }), /^[a-f0-9]{64}$/);
});
