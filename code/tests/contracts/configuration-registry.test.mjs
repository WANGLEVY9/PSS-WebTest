import test from 'node:test';
import assert from 'node:assert/strict';
import { findConfiguration, loadConfigurationRegistry, validateConfigurationRegistry } from '../../src/configuration-registry.mjs';

test('configuration registry records legacy configurations separately across all strategy families', () => {
  const registry = loadConfigurationRegistry();
  assert.equal(registry.schema_version, '0.2');
  assert.deepEqual(new Set(registry.configurations.map((item) => item.family)), new Set(['visual', 'hybrid', 'scripted']));
  assert.equal(findConfiguration(registry, 'legacy-scripted-playwright-accessibility-human').test_implementation.authoring_source, 'human');
  assert.equal(registry.configurations.filter((item) => item.status === 'legacy-pilot').length, 5);
  assert.equal(registry.configurations.filter((item) => item.status === 'implemented').length, 5);
});

test('configuration registry rejects a visual configuration with structured observation or code provenance', () => {
  const invalid = {
    schema_version: '0.2', protocol_version: 'test', purpose: 'test', configurations: [{
      configuration_id: 'visual-invalid-contract', family: 'visual', status: 'candidate',
      framework: { id: 'adapter', version: '1' }, observation_contract: 'screenshot-plus-structure',
      runtime: { provider_id: 'provider', model_id: 'model', action_schema_version: 'v1', prompt_digest: 'a'.repeat(64) },
      test_implementation: { code_framework: 'playwright', authoring_source: 'human' },
      admission: { status: 'not-started', evidence: [] }
    }]
  };
  assert.throws(() => validateConfigurationRegistry(invalid), /observation_contract|test_implementation/);
});
