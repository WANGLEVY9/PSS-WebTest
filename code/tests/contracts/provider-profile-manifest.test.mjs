import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ProviderProfileNotFoundError,
  ProviderProfileViolationError,
  assertProtocolMatchesFrozenProfile,
  findProviderProfile,
  loadProviderProfileManifest,
  resolveProviderProtocol,
  validateProviderProfileManifest
} from '../../src/provider-profile.mjs';
import { createVolcengineCuaDriver } from '../../src/arms/volcengine-cua-driver.mjs';
import { createVolcengineHybridDriver } from '../../src/arms/volcengine-hybrid-driver.mjs';

test('frozen manifest is internally consistent', () => {
  const result = validateProviderProfileManifest(loadProviderProfileManifest());
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.ok(result.profile_count >= 4);
});

test('resolves the frozen action mode when the environment omits it', () => {
  const protocol = resolveProviderProtocol({
    env: { CUA_PROVIDER: 'volcengine', CUA_MODEL: 'doubao-seed-2-0-pro-260215' },
    provider: 'volcengine',
    model: 'doubao-seed-2-0-pro-260215',
    arm: 'visual'
  });
  // The .env.doubao profile omits CUA_VOLCENGINE_ACTION_MODE; the implicit
  // driver default used to be json. The manifest now makes it explicit.
  assert.equal(protocol.action_mode, 'json');
  assert.equal(protocol.action_mode_source, 'frozen-profile');
  assert.equal(protocol.profile_id, 'volcengine-doubao-2-0-pro-json-legacy-v1');
});

test('an explicit environment value still wins and is labelled as an override', () => {
  const protocol = resolveProviderProtocol({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3.7-flash', CUA_ALIYUN_ACTION_MODE: 'json' },
    provider: 'aliyun',
    model: 'qwen3.7-flash',
    arm: 'visual'
  });
  assert.equal(protocol.action_mode, 'json');
  assert.equal(protocol.action_mode_source, 'env-override');
  assert.equal(protocol.frozen_action_mode, 'tool');
});

test('unknown provider/model falls back to a labelled legacy default unless strict', () => {
  const lenient = resolveProviderProtocol({ env: {}, provider: 'volcengine', model: 'test-model', arm: 'visual' });
  assert.equal(lenient.action_mode, 'json');
  assert.equal(lenient.action_mode_source, 'legacy-default');
  assert.equal(lenient.frozen, false);
  assert.throws(
    () => resolveProviderProtocol({ env: { PSS_REQUIRE_FROZEN_PROFILE: '1' }, provider: 'volcengine', model: 'test-model', arm: 'visual' }),
    ProviderProfileNotFoundError
  );
});

test('the drift assertion fails closed and requires an explicit override opt-in', () => {
  const env = { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3.7-flash', CUA_ALIYUN_ACTION_MODE: 'json' };
  assert.throws(() => assertProtocolMatchesFrozenProfile({ env, provider: 'aliyun', model: 'qwen3.7-flash', arm: 'visual' }), ProviderProfileViolationError);
  const allowed = assertProtocolMatchesFrozenProfile({ env: { ...env, PSS_ALLOW_PROTOCOL_OVERRIDE: '1' }, provider: 'aliyun', model: 'qwen3.7-flash', arm: 'visual' });
  assert.equal(allowed.override_allowed, true);
  assert.equal(allowed.drift.length, 1);
  assert.equal(allowed.drift[0].field, 'action_mode');
});

test('findProviderProfile matches provider and model exactly', () => {
  assert.equal(findProviderProfile({ provider: 'aliyun', model: 'qwen3.7-flash' })?.profile_id, 'aliyun-qwen3.7-flash-tool-v1');
  assert.equal(findProviderProfile({ provider: 'aliyun', model: 'qwen3-flash' }), null);
});

test('manifest validation rejects duplicate profiles and invalid enums', () => {
  const manifest = loadProviderProfileManifest();
  const duplicated = { ...manifest, profiles: [manifest.profiles[0], manifest.profiles[0]] };
  const result = validateProviderProfileManifest(duplicated);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /duplicated|duplicates/.test(error)));
  const invalid = { ...manifest, profiles: [{ ...manifest.profiles[0], action_mode: 'yaml' }] };
  assert.equal(validateProviderProfileManifest(invalid).ok, false);
});

test('drivers report the resolved frozen profile in the run provenance source', async () => {
  const visual = createVolcengineCuaDriver({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3.7-flash', CUA_API_KEY: 'test-key' },
    observeScreenshot: async () => 'abc123',
    executeAction: async () => {},
    fetchImpl: async () => ({ ok: true, status: 200, async json() { return { choices: [{ message: { content: '{"type":"done","verdict":"pass"}' } }] }; } })
  });
  assert.equal(visual.getProtocolResolution().profile_id, 'aliyun-qwen3.7-flash-tool-v1');
  assert.equal(visual.getProtocolResolution().action_mode, 'tool');

  const hybrid = createVolcengineHybridDriver({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3.7-flash', CUA_API_KEY: 'test-key', CUA_HYBRID_ACTION_MODE: 'semantic' },
    observeHybrid: async () => ({ screenshot: 'abc123', pageStructure: { controls: [{ target_id: 'c12', role: 'link', name: 'New Page' }] } }),
    executeAction: async () => {},
    fetchImpl: async () => ({ ok: true, status: 200, async json() { return { choices: [{ message: { content: '{"type":"done","verdict":"pass"}' } }] }; } })
  });
  assert.equal(hybrid.getProtocolResolution().profile_id, 'aliyun-qwen3.7-flash-tool-v1');
  assert.equal(hybrid.getProtocolResolution().action_mode_source, 'frozen-profile');
});
