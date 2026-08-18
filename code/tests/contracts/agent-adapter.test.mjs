import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AgentProviderNotConfiguredError,
  createAgentAdapter,
  requireProviderConfig
} from '../../src/arms/agent-adapter.mjs';

test('provider readiness never prints or returns the API key', () => {
  assert.throws(
    () => requireProviderConfig({ CUA_PROVIDER: 'example', CUA_MODEL: 'model' }),
    AgentProviderNotConfiguredError
  );
  const config = requireProviderConfig({ CUA_PROVIDER: 'example', CUA_MODEL: 'model', CUA_API_KEY: 'test-only-placeholder' });
  assert.deepEqual(config, { provider: 'example', model: 'model', configured: true });
});

test('agent adapter enforces the visual observation contract before action', async () => {
  const seen = [];
  const adapter = createAgentAdapter({
    arm: 'visual',
    driver: {
      async observe() { return { screenshot: 'sha256:screen', viewport: { width: 1280, height: 720 } }; },
      async decide({ step }) { return step === 0 ? { type: 'action', action: { type: 'click', x: 10, y: 20 } } : { type: 'done', verdict: 'clean' }; },
      async act(action) { seen.push(action); }
    },
    maxSteps: 3
  });
  const result = await adapter.run({ intent: 'Complete the fixed task.' });
  assert.equal(result.status, 'completed');
  assert.equal(result.emitted_verdict, 'clean');
  assert.equal(seen.length, 1);
});

test('agent adapter rejects structured-page leakage in the visual driver', async () => {
  const adapter = createAgentAdapter({
    arm: 'visual',
    driver: {
      async observe() { return { screenshot: 'sha256:screen', pageStructure: {} }; },
      async decide() { return { type: 'done', verdict: 'unknown' }; },
      async act() {}
    }
  });
  await assert.rejects(() => adapter.run({ intent: 'Complete the fixed task.' }), /pageStructure/);
});
