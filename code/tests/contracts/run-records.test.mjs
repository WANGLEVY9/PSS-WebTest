import test from 'node:test';
import assert from 'node:assert/strict';
import { createRunRecord, traceHash, validateRunRecordAgainstRegistry } from '../../src/run-records.mjs';
import { loadConfigurationRegistry } from '../../src/configuration-registry.mjs';

const base = () => createRunRecord({ run_id: 'juice-1', application_id: 'juice-shop', application_version: '20.0.0', task_id: 'search', condition: 'clean', arm: 'visual', status: 'completed', checkpoint_reached: true, emitted_verdict: 'clean', ground_truth_verdict: 'clean', timing: { wall_time_ms: 10, actions: 1, retries: 0 }, provenance: { runner_version: '0.1.0', observation_contract: 'screenshot-only', model_id: 'doubao-seed-2-0-pro-260215' }, trace: [{ action: 'keypress', key: 'ENTER' }] });

test('creates schema-compatible immutable record with trace hash', () => {
  const r = base();
  assert.equal(r.provenance.trace_hash, traceHash([{ action: 'keypress', key: 'ENTER' }]));
  assert.equal(r.failure_category, null);
  assert.equal('trace' in r, false);
});
test('persists the independent oracle outcome without accepting hidden oracle state', () => {
  const r = createRunRecord({ ...base(), independent_oracle_passed: true });
  assert.equal(r.independent_oracle_passed, true);
  assert.throws(() => createRunRecord({ ...base(), independent_oracle_passed: 'true' }), /independent_oracle_passed/);
});
test('rejects credentials and provider secrets', () => {
  assert.throws(() => createRunRecord({ ...base(), trace: [{ api_key: 'sk-should-not-be-recorded' }] }), /sensitive field/);
  assert.throws(() => createRunRecord({ ...base(), provenance: { runner_version: 'x', observation_contract: 'screenshot-only', trace_hash: 'x', authorization: 'Bearer abcdefghijklmnop' } }), /sensitive field/);
});
test('rejects malformed status and timing', () => {
  assert.throws(() => createRunRecord({ ...base(), status: 'success' }), /unsupported status/);
  assert.throws(() => createRunRecord({ ...base(), timing: { wall_time_ms: -1, actions: 0, retries: 0 } }), /invalid timing/);
  assert.throws(() => createRunRecord({ ...base(), failure_category: 'unclassified' }), /unsupported failure_category/);
});

test('creates a v0.2 record with frozen configuration and environment provenance', () => {
  const digest = (character) => character.repeat(64);
  const record = createRunRecord({
    run_id: 'bookstack-v02-1', application_id: 'bookstack', application_version: '24.10.1', task_id: 'bookstack-create-page', condition: 'clean-stable',
    schema_version: '0.2', arm: 'visual', strategy_family: 'visual', configuration_id: 'visual-pss-native-qwen-v2', protocol_version: '2.0-draft',
    run_manifest_digest: digest('a'), sut_image_digest: digest('b'), reset_digest: digest('c'), randomization_block: 'bookstack-clean-block-01',
    status: 'completed', checkpoint_reached: true, emitted_verdict: 'clean', ground_truth_verdict: 'clean', timing: { wall_time_ms: 12, actions: 2, retries: 0 },
    provenance: {
      runner_version: '2.0.0', observation_contract: 'screenshot-only', framework_id: 'pss-native', framework_version: '2.0', provider_id: 'aliyun-compatible', model_id: 'qwen3-vl-flash',
      prompt_digest: digest('d'), action_schema_version: 'coordinate-action-v0.2', code_framework: null, authoring_source: null, environment_digest: digest('e')
    },
    trace: [{ action: 'click', x: 10, y: 20 }]
  });
  assert.equal(record.schema_version, '0.2');
  assert.equal(record.configuration_id, 'visual-pss-native-qwen-v2');
  assert.match(record.provenance.trace_hash, /^[a-f0-9]{64}$/);
});

test('rejects v0.2 configuration-family and provenance mismatches', () => {
  const digest = (character) => character.repeat(64);
  const record = {
    run_id: 'scripted-v02-1', application_id: 'bookstack', application_version: '24.10.1', task_id: 'bookstack-create-page', condition: 'clean-stable',
    schema_version: '0.2', arm: 'playwright', strategy_family: 'visual', configuration_id: 'scripted-playwright-human-v2', protocol_version: '2.0-draft',
    run_manifest_digest: digest('a'), sut_image_digest: digest('b'), reset_digest: digest('c'), randomization_block: 'block-01',
    status: 'completed', checkpoint_reached: true, emitted_verdict: 'clean', ground_truth_verdict: 'clean', timing: { wall_time_ms: 12, actions: 2, retries: 0 },
    provenance: {
      runner_version: '2.0.0', observation_contract: 'scripted-locator', framework_id: 'playwright', framework_version: '1.55', provider_id: null, model_id: null,
      prompt_digest: null, action_schema_version: null, code_framework: 'playwright-accessibility-locator', authoring_source: 'human', environment_digest: digest('e')
    }
  };
  assert.throws(() => createRunRecord(record), /strategy_family/);
});

test('resolves v0.2 records against the configuration registry', () => {
  const digest = (character) => character.repeat(64);
  const registry = loadConfigurationRegistry();
  const configuration = registry.configurations.find((item) => item.configuration_id === 'visual-pss-native-aliyun-qwen3-vl-flash-v2');
  const record = createRunRecord({
    run_id: 'bookstack-v02-registry-1', application_id: 'bookstack', application_version: '24.10.1', task_id: 'bookstack-create-page', condition: 'clean-stable',
    schema_version: '0.2', arm: 'visual', strategy_family: 'visual', configuration_id: configuration.configuration_id, protocol_version: registry.protocol_version,
    run_manifest_digest: digest('a'), sut_image_digest: digest('b'), reset_digest: digest('c'), randomization_block: 'bookstack-clean-block-01',
    status: 'completed', checkpoint_reached: true, emitted_verdict: 'clean', ground_truth_verdict: 'clean', timing: { wall_time_ms: 12, actions: 2, retries: 0 },
    provenance: {
      runner_version: '2.0.0', observation_contract: configuration.observation_contract, framework_id: configuration.framework.id, framework_version: configuration.framework.version,
      provider_id: configuration.runtime.provider_id, model_id: configuration.runtime.model_id, prompt_digest: configuration.runtime.prompt_digest,
      action_schema_version: configuration.runtime.action_schema_version, code_framework: null, authoring_source: null, environment_digest: digest('e')
    }, trace: [{ action: 'click', x: 10, y: 20 }]
  });
  assert.equal(validateRunRecordAgainstRegistry(record, registry).configuration_id, configuration.configuration_id);
  assert.throws(() => validateRunRecordAgainstRegistry({ ...record, protocol_version: 'wrong' }, registry), /protocol_version/);
  assert.throws(() => validateRunRecordAgainstRegistry({ ...record, configuration_id: 'unknown-visual-config-v2' }, registry), /unknown configuration_id/);
});
