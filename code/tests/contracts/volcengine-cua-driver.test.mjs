import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDecision, parseToolDecision, createVolcengineCuaDriver } from '../../src/arms/volcengine-cua-driver.mjs';

test('parses a bounded click decision', () => {
  assert.deepEqual(parseDecision('{"type":"action","action":{"type":"click","x":12,"y":34}}'), { type: 'action', action: { type: 'click', x: 12, y: 34 } });
  assert.deepEqual(parseDecision('{"type":"action","action":{"type":"click","x":12,"y":34,"element_selector":"#hidden"}}'), { type: 'action', action: { type: 'click', x: 12, y: 34 } });
  assert.deepEqual(parseDecision('{"type":"action","action":{"type":"click","x":1231,"y":99}}', { coordinateMode: 'pixels' }), { type: 'action', action: { type: 'click', x: 1231, y: 99 } });
  assert.deepEqual(parseDecision('{"type":"action","action":{"type":"click","x":746,"y":962}}', { coordinateMode: 'auto' }), { type: 'action', action: { type: 'click', x: 746, y: 962 } });
});

test('rejects malformed or unsupported decisions', () => {
  assert.throws(() => parseDecision('not-json'), /valid JSON/);
  assert.throws(() => parseDecision('{"type":"action","action":{"type":"locator"}}'), /unsupported/);
  assert.throws(() => parseDecision('{"type":"action","action":{"type":"type","text":"line1\\nline2"}}'), /single line/);
  assert.throws(() => parseDecision('{"type":"action","action":{"type":"click","x":1231,"y":71}}'), /normalized coordinates/);
  assert.throws(() => parseDecision('{"type":"action","action":{"type":"click","x":12.5,"y":34}}'), /normalized coordinates/);
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

test('driver rejects a repeated non-progressing click and asks the provider again', async () => {
  let calls = 0;
  const driver = createVolcengineCuaDriver({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3-vl-flash', CUA_API_KEY: 'test-key', CUA_MAX_DECISION_RETRIES: '1' },
    observeScreenshot: async () => 'abc123',
    executeAction: async () => {},
    fetchImpl: async () => {
      calls += 1;
      const message = calls === 1
        ? { tool_calls: [{ function: { name: 'ui_action', arguments: '{"action_type":"click","x":10,"y":10}' } }] }
        : calls === 2
        ? { tool_calls: [{ function: { name: 'ui_action', arguments: '{"action_type":"click","x":10,"y":10}' } }] }
        : { tool_calls: [{ function: { name: 'ui_action', arguments: '{"action_type":"done","verdict":"pass"}' } }] };
      return { ok: true, status: 200, async json() { return { choices: [{ message }] }; } };
    }
  });
  const observation = await driver.observe();
  const first = await driver.decide({ intent: 'Inspect the page', observation, step: 0 });
  assert.deepEqual(first, { type: 'action', action: { type: 'click', x: 13, y: 7, coordinate_mode: 'pixels' } });
  const second = await driver.decide({ intent: 'Inspect the page', observation, step: 1 });
  assert.deepEqual(second, { type: 'done', verdict: 'pass' });
  assert.equal(calls, 3);
});

test('driver permits the same coordinate after the screenshot visibly changes', async () => {
  let calls = 0;
  let screenshot = 'before-navigation';
  const driver = createVolcengineCuaDriver({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3-vl-flash', CUA_API_KEY: 'test-key', CUA_MAX_DECISION_RETRIES: '0' },
    observeScreenshot: async () => screenshot,
    executeAction: async () => {},
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, async json() { return { choices: [{ message: { tool_calls: [{ function: { name: 'ui_action', arguments: '{"action_type":"click","x":10,"y":10}' } }] } }] }; } };
    }
  });
  const firstObservation = await driver.observe();
  await driver.decide({ intent: 'Navigate', observation: firstObservation, step: 0 });
  screenshot = 'after-navigation';
  const secondObservation = await driver.observe();
  const second = await driver.decide({ intent: 'Navigate', observation: secondObservation, step: 1 });
  assert.equal(second.type, 'action');
  assert.equal(calls, 2);
});

test('driver enforces an optional agent wall-time budget before another provider call', async () => {
  let calls = 0;
  const driver = createVolcengineCuaDriver({
    env: { CUA_PROVIDER: 'volcengine', CUA_MODEL: 'test-model', CUA_API_KEY: 'test-key' },
    wallTimeoutMs: 1,
    observeScreenshot: async () => 'abc123',
    executeAction: async () => {},
    fetchImpl: async () => { calls += 1; return { ok: true, status: 200, async json() { return { choices: [{ message: { content: '{"type":"done","verdict":"pass"}' } }] }; } }; }
  });
  const observation = await driver.observe();
  await new Promise((resolve) => setTimeout(resolve, 5));
  await assert.rejects(() => driver.decide({ intent: 'Inspect', observation, step: 0 }), /wall-time budget/);
  assert.equal(calls, 0);
});
