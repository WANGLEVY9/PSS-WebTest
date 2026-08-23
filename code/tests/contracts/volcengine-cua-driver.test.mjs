import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDecision, parseToolDecision, createVolcengineCuaDriver } from '../../src/arms/volcengine-cua-driver.mjs';

test('parses a bounded click decision', () => {
  assert.deepEqual(parseDecision('{"type":"action","action":{"type":"click","x":12,"y":34}}'), { type: 'action', action: { type: 'click', x: 12, y: 34 } });
  assert.deepEqual(parseDecision('{"type":"action","action":{"type":"click","x":12,"y":34,"element_selector":"#hidden"}}'), { type: 'action', action: { type: 'click', x: 12, y: 34 } });
});

test('rejects malformed or unsupported decisions', () => {
  assert.throws(() => parseDecision('not-json'), /valid JSON/);
  assert.throws(() => parseDecision('{"type":"action","action":{"type":"locator"}}'), /unsupported/);
  assert.throws(() => parseDecision('{"type":"action","action":{"type":"type","text":"line1\\nline2"}}'), /single line/);
});

test('parses a bounded Alibaba function-call decision', () => {
  assert.deepEqual(parseToolDecision({ function: { name: 'ui_action', arguments: '{"action_type":"type","text":"PSS Phase2 Content"}' } }), {
    type: 'action', action: { type: 'type', text: 'PSS Phase2 Content' }
  });
  assert.deepEqual(parseToolDecision({ function: { name: 'ui_action', arguments: '{"action_type":"done","verdict":"pass"}' } }), {
    type: 'done', verdict: 'pass'
  });
  assert.deepEqual(parseToolDecision({ function: { name: 'ui_action', arguments: '{"action":{"type":"click","x":12,"y":34}}' } }), {
    type: 'action', action: { type: 'click', x: 12, y: 34 }
  });
  assert.deepEqual(parseToolDecision({ function: { name: 'ui_action', arguments: '{"action":{"action_type":"click","x":12,"y":34}}' } }), {
    type: 'action', action: { type: 'click', x: 12, y: 34 }
  });
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
    fetchImpl: async (url, options) => { request = { url, options }; return { ok: true, status: 200, async json() { return { choices: [{ message: { content: '{"type":"done","verdict":"pass"}' } }] }; } }; }
  });
  const observation = await driver.observe();
  const decision = await driver.decide({ intent: 'Inspect the page', observation, step: 0 });
  assert.equal(decision.verdict, 'pass');
  assert.equal(request.url, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
  const body = JSON.parse(request.options.body);
  assert.equal(body.enable_thinking, false);
  assert.equal(body.max_completion_tokens, 512);
  assert.equal(body.max_tokens, undefined);
  assert.equal(body.presence_penalty, 1.5);
  assert.equal(body.response_format, undefined);
  assert.equal(body.tool_choice.function.name, 'ui_action');
  assert.equal(body.tools[0].function.name, 'ui_action');
});

test('Alibaba driver retries one empty tool-call argument set without changing the observation', async () => {
  let calls = 0;
  const driver = createVolcengineCuaDriver({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3-vl-flash', CUA_API_KEY: 'test-key', CUA_MAX_DECISION_RETRIES: '1' },
    observeScreenshot: async () => 'abc123',
    executeAction: async () => {},
    fetchImpl: async () => {
      calls += 1;
      const message = calls === 1
        ? { tool_calls: [{ function: { name: 'ui_action', arguments: '{}' } }] }
        : { tool_calls: [{ function: { name: 'ui_action', arguments: '{"action_type":"done","verdict":"pass"}' } }] };
      return { ok: true, status: 200, async json() { return { choices: [{ message }] }; } };
    }
  });
  const observation = await driver.observe();
  const decision = await driver.decide({ intent: 'Inspect the page', observation, step: 0 });
  assert.deepEqual(decision, { type: 'done', verdict: 'pass' });
  assert.equal(calls, 2);
  assert.equal(driver.getRetryCount(), 1);
});
