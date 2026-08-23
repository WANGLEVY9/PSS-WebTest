import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDecision, createVolcengineCuaDriver } from '../../src/arms/volcengine-cua-driver.mjs';

test('parses a bounded click decision', () => {
  assert.deepEqual(parseDecision('{"type":"action","action":{"type":"click","x":12,"y":34}}'), { type: 'action', action: { type: 'click', x: 12, y: 34 } });
});

test('rejects malformed or unsupported decisions', () => {
  assert.throws(() => parseDecision('not-json'), /valid JSON/);
  assert.throws(() => parseDecision('{"type":"action","action":{"type":"locator"}}'), /unsupported/);
});

test('driver sends screenshot-only input and parses provider response', async () => {
  let request;
  const driver = createVolcengineCuaDriver({
    env: { CUA_PROVIDER: 'volcengine', CUA_MODEL: 'test-model', CUA_API_KEY: 'test-key', CUA_BASE_URL: 'https://example.test/v1' },
    observeScreenshot: async () => 'abc123',
    executeAction: async () => {},
    fetchImpl: async (url, options) => { request = { url, options }; return { ok: true, status: 200, async json() { return { choices: [{ message: { content: '{"type":"done","verdict":"pass"}' } }] }; } }; }
  });
  const observation = await driver.observe();
  const decision = await driver.decide({ intent: 'Do the task', observation, step: 0 });
  assert.equal(decision.verdict, 'pass');
  assert.equal(request.url, 'https://example.test/v1/chat/completions');
  assert.match(request.options.body, /data:image\/png;base64,abc123/);
});

test('driver accepts Alibaba OpenAI-compatible provider configuration', async () => {
  let request;
  const driver = createVolcengineCuaDriver({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3-vl-flash', CUA_API_KEY: 'test-key' },
    observeScreenshot: async () => 'abc123',
    executeAction: async () => {},
    fetchImpl: async (url) => { request = url; return { ok: true, status: 200, async json() { return { choices: [{ message: { content: '{"type":"done","verdict":"pass"}' } }] }; } }; }
  });
  const observation = await driver.observe();
  const decision = await driver.decide({ intent: 'Inspect the page', observation, step: 0 });
  assert.equal(decision.verdict, 'pass');
  assert.equal(request, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
});
