import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDecision, parseToolDecision, createVolcengineCuaDriver } from '../../src/arms/volcengine-cua-driver.mjs';

test('parses a bounded click decision', () => {
  assert.deepEqual(parseDecision('{"type":"action","action":{"type":"click","x":12,"y":34}}'), { type: 'action', action: { type: 'click', x: 12, y: 34 } });
  assert.deepEqual(parseDecision('{"type":"action","action":{"type":"click","x":12,"y":34,"element_selector":"#hidden"}}'), { type: 'action', action: { type: 'click', x: 12, y: 34 } });
  assert.deepEqual(parseDecision('{"type":"action","action":{"type":"click","x":1231,"y":99}}', { coordinateMode: 'pixels' }), { type: 'action', action: { type: 'click', x: 1231, y: 99 } });
  assert.deepEqual(parseDecision('{"type":"action","action":{"type":"click","x":746,"y":962}}', { coordinateMode: 'auto' }), { type: 'action', action: { type: 'click', x: 746, y: 962 } });
});

test('parses an unambiguous visual coordinate tuple without accepting arbitrary coordinate objects', () => {
  assert.deepEqual(
    parseDecision('{"type":"action","action":{"type":"click","x":[753,43],"y":null}}', { coordinateMode: 'normalized_1000' }),
    { type: 'action', action: { type: 'click', x: 753, y: 43 } }
  );
  assert.throws(
    () => parseDecision('{"type":"action","action":{"type":"click","x":{"x":753,"y":43},"y":null}}', { coordinateMode: 'normalized_1000' }),
    /pointer action coordinates/
  );
  assert.deepEqual(
    parseDecision('{"type":"action","action":{"type":"click","x":"80","y":"251"}}', { coordinateMode: 'normalized_1000' }),
    { type: 'action', action: { type: 'click', x: 80, y: 251 } }
  );
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

test('Volcengine Responses API mode sends input_image and parses function_call output', async () => {
  let request;
  const driver = createVolcengineCuaDriver({
    env: {
      CUA_PROVIDER: 'volcengine', CUA_MODEL: 'doubao-seed-2-1-pro-260628', CUA_API_KEY: 'test-key',
      CUA_BASE_URL: 'https://example.test/v1', CUA_VOLCENGINE_API_MODE: 'responses', CUA_VOLCENGINE_ACTION_MODE: 'tool'
    },
    observeScreenshot: async () => 'abc123',
    executeAction: async () => {},
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, async json() {
        return { status: 'completed', output: [{ type: 'function_call', name: 'ui_action', arguments: '{"action_type":"click","x":20,"y":30}' }] };
      } };
    }
  });
  const decision = await driver.decide({ intent: 'Inspect the page', observation: await driver.observe(), step: 0 });
  assert.deepEqual(decision.action, { type: 'click', x: 26, y: 22, coordinate_mode: 'pixels' });
  assert.equal(request.url, 'https://example.test/v1/responses');
  const body = JSON.parse(request.options.body);
  assert.equal(body.messages, undefined);
  assert.equal(body.input[0].content[0].type, 'input_text');
  assert.equal(body.input[0].content[1].type, 'input_image');
  assert.equal(body.tools[0].name, 'ui_action');
  assert.equal(body.tools[0].function, undefined);
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

test('Alibaba JSON action mode uses a strict textual JSON response instead of function parameters', async () => {
  let request;
  const driver = createVolcengineCuaDriver({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3.7-flash', CUA_API_KEY: 'test-key', CUA_ALIYUN_ACTION_MODE: 'json' },
    observeScreenshot: async () => 'abc123', executeAction: async () => {},
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, async json() { return { choices: [{ message: { content: '{"type":"action","action":{"type":"click","x":20,"y":30}}' } }] }; } };
    }
  });
  const decision = await driver.decide({ intent: 'Inspect the page', observation: await driver.observe(), step: 0 });
  assert.deepEqual(decision.action, { type: 'click', x: 26, y: 22, coordinate_mode: 'pixels' });
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.equal(body.tools, undefined);
  assert.match(body.messages[0].content[0].text, /JSON object/);
});

test('DeepSeek V4.1-Flash profile uses the official OpenAI-compatible vision endpoint and tool-call action mode', async () => {
  let request;
  const driver = createVolcengineCuaDriver({
    env: { CUA_PROVIDER: 'deepseek', CUA_MODEL: 'deepseek-flash', CUA_API_KEY: 'test-key' },
    observeScreenshot: async () => 'abc123',
    executeAction: async () => {},
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, async json() { return { choices: [{ message: { tool_calls: [{ function: { name: 'ui_action', arguments: '{"action_type":"click","x":20,"y":30}' } }] } }] }; } };
    }
  });
  const decision = await driver.decide({ intent: 'Inspect the page', observation: await driver.observe(), step: 0 });
  assert.deepEqual(decision.action, { type: 'click', x: 26, y: 22, coordinate_mode: 'pixels' });
  assert.equal(request.url, 'https://api.deepseek.com/chat/completions');
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, 'deepseek-flash');
  assert.deepEqual(body.thinking, { type: 'disabled' });
  assert.equal(body.response_format, undefined);
  assert.equal(body.tool_choice.function.name, 'ui_action');
  assert.equal(body.tools[0].function.name, 'ui_action');
  assert.match(body.messages[0].content[1].image_url.url, /data:image\/png;base64,abc123/);
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

test('visual retry prompt re-plans after a rejected click', async () => {
  let calls = 0;
  const requests = [];
  const driver = createVolcengineCuaDriver({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3.7-flash', CUA_API_KEY: 'test-key', CUA_MAX_DECISION_RETRIES: '1' },
    observeScreenshot: async () => 'same-screen',
    executeAction: async () => {},
    fetchImpl: async (url, options) => {
      calls += 1;
      requests.push(JSON.parse(options.body));
      const message = calls === 1
        ? { tool_calls: [{ function: { name: 'ui_action', arguments: '{"action_type":"click","x":10,"y":10}' } }] }
        : { tool_calls: [{ function: { name: 'ui_action', arguments: '{"action_type":"click","x":10,"y":10}' } }] };
      return { ok: true, status: 200, async json() { return { choices: [{ message }] }; } };
    }
  });
  const observation = await driver.observe();
  await driver.decide({ intent: 'Open the next task-specific control', observation, step: 0 });
  await assert.rejects(() => driver.decide({ intent: 'Open the next task-specific control', observation, step: 1 }), /repeated non-progressing click/);
  assert.ok(requests.some((body) => body.messages[0].content[0].text.includes('Re-plan from the current screenshot')));
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

test('driver permits the same coordinate after a harness progress token changes', async () => {
  let progressToken = 'search-results:entry';
  const driver = createVolcengineCuaDriver({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3-vl-flash', CUA_API_KEY: 'test-key', CUA_MAX_DECISION_RETRIES: '0' },
    observeScreenshot: async () => ({ screenshot: 'same-pixels', progressToken }),
    executeAction: async () => {},
    fetchImpl: async () => ({ ok: true, status: 200, async json() { return { choices: [{ message: { tool_calls: [{ function: { name: 'ui_action', arguments: '{"action_type":"click","x":10,"y":10}' } }] } }] }; } })
  });
  await driver.decide({ intent: 'Reopen the target', observation: await driver.observe(), step: 0 });
  progressToken = 'search-results:after-back';
  const second = await driver.decide({ intent: 'Reopen the target', observation: await driver.observe(), step: 1 });
  assert.equal(second.type, 'action');
});

test('driver permits a legitimate revisit after an A-B-A navigation cycle', async () => {
  let progressToken = 'search-results';
  const driver = createVolcengineCuaDriver({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3-vl-flash', CUA_API_KEY: 'test-key', CUA_MAX_DECISION_RETRIES: '0' },
    observeScreenshot: async () => ({ screenshot: 'same-pixels', progressToken }),
    executeAction: async () => {},
    fetchImpl: async () => ({ ok: true, status: 200, async json() { return { choices: [{ message: { content: '{"type":"action","action":{"type":"click","x":10,"y":10}}' } }] }; } })
  });
  await driver.decide({ intent: 'Open, go back, and reopen', observation: await driver.observe(), step: 0 });
  progressToken = 'product-detail';
  await driver.decide({ intent: 'Open, go back, and reopen', observation: await driver.observe(), step: 1 });
  progressToken = 'search-results';
  const second = await driver.decide({ intent: 'Open, go back, and reopen', observation: await driver.observe(), step: 2 });
  assert.equal(second.type, 'action');
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
