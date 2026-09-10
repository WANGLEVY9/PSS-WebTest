import assert from 'node:assert/strict';
import test from 'node:test';
import { createVolcengineHybridDriver } from '../../src/arms/volcengine-hybrid-driver.mjs';

test('hybrid driver sends screenshot and declared structure, never hidden evaluator fields', async () => {
  let request;
  const driver = createVolcengineHybridDriver({
    env: { CUA_PROVIDER: 'volcengine', CUA_MODEL: 'test-model', CUA_API_KEY: 'test-key', CUA_BASE_URL: 'https://example.test/v1' },
    observeHybrid: async () => ({ screenshot: 'abc123', pageStructure: { role: 'main', children: [{ role: 'button', name: 'Save' }] }, structureSchema: 'a11y-v1' }),
    executeAction: async () => {},
    fetchImpl: async (url, options) => { request = { url, options }; return { ok: true, status: 200, async json() { return { choices: [{ message: { content: '{"type":"done","verdict":"pass"}' } }] }; } }; }
  });
  const observation = await driver.observe();
  const decision = await driver.decide({ intent: 'Save the page', observation, step: 0 });
  assert.equal(decision.verdict, 'pass');
  const body = JSON.parse(request.options.body);
  const prompt = body.messages[0].content[0].text;
  assert.match(prompt, /pageStructure|Accessibility\/page structure/);
  assert.match(prompt, /Save/);
  assert.doesNotMatch(prompt, /goldOracle|applicationState|mutationLabel/);
  assert.match(body.messages[0].content[1].image_url.url, /data:image\/png;base64,abc123/);
});

test('hybrid driver rejects nested hidden evaluator fields before provider request', async () => {
  const driver = createVolcengineHybridDriver({
    env: { CUA_PROVIDER: 'volcengine', CUA_MODEL: 'test-model', CUA_API_KEY: 'test-key' },
    observeHybrid: async () => ({ screenshot: 'abc123', pageStructure: { children: [{ role: 'button', goldOracle: 'hidden' }] } }),
    executeAction: async () => {}, fetchImpl: async () => { throw new Error('must not call provider'); }
  });
  await assert.rejects(() => driver.observe(), /goldOracle/);
});

test('hybrid Alibaba driver uses function-call output without leaking evaluator fields', async () => {
  let request;
  const driver = createVolcengineHybridDriver({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3-vl-flash', CUA_API_KEY: 'test-key' },
    observeHybrid: async () => ({ screenshot: 'abc123', pageStructure: { role: 'main', children: [{ role: 'button', name: 'Save' }] } }),
    executeAction: async () => {},
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, async json() { return { choices: [{ message: { tool_calls: [{ function: { name: 'ui_action', arguments: '{"action_type":"click","x":20,"y":30}' } }] } }] }; } };
    }
  });
  const observation = await driver.observe();
  const decision = await driver.decide({ intent: 'Save the page', observation, step: 0 });
  assert.deepEqual(decision.action, { type: 'click', x: 26, y: 22, coordinate_mode: 'pixels' });
  const body = JSON.parse(request.options.body);
  assert.equal(body.enable_thinking, false);
  assert.equal(body.tool_choice.function.name, 'ui_action');
  assert.doesNotMatch(body.messages[0].content[0].text, /goldOracle|applicationState|mutationLabel/);
});

test('hybrid Alibaba JSON action mode preserves the structure boundary and avoids function parameters', async () => {
  let request;
  const driver = createVolcengineHybridDriver({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3.7-flash', CUA_API_KEY: 'test-key', CUA_ALIYUN_ACTION_MODE: 'json' },
    observeHybrid: async () => ({ screenshot: 'abc123', pageStructure: { role: 'main', children: [{ role: 'button', name: 'Save' }] } }),
    executeAction: async () => {},
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, async json() { return { choices: [{ message: { content: '{"type":"done","verdict":"pass"}' } }] }; } };
    }
  });
  const decision = await driver.decide({ intent: 'Save the page', observation: await driver.observe(), step: 0 });
  assert.equal(decision.verdict, 'pass');
  const body = JSON.parse(request.options.body);
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.equal(body.tools, undefined);
  assert.doesNotMatch(body.messages[0].content[0].text, /goldOracle|applicationState|mutationLabel/);
});

test('hybrid DeepSeek V4.1-Flash profile sends screenshot plus declared structure with tool-call output', async () => {
  let request;
  const driver = createVolcengineHybridDriver({
    env: { CUA_PROVIDER: 'deepseek', CUA_MODEL: 'deepseek-flash', CUA_API_KEY: 'test-key' },
    observeHybrid: async () => ({ screenshot: 'abc123', pageStructure: { role: 'main', children: [{ role: 'button', name: 'Save' }] } }),
    executeAction: async () => {},
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, async json() { return { choices: [{ message: { tool_calls: [{ function: { name: 'ui_action', arguments: '{"action_type":"click","x":20,"y":30}' } }] } }] }; } };
    }
  });
  const observation = await driver.observe();
  const decision = await driver.decide({ intent: 'Save the page', observation, step: 0 });
  assert.deepEqual(decision.action, { type: 'click', x: 26, y: 22, coordinate_mode: 'pixels' });
  assert.equal(request.url, 'https://api.deepseek.com/chat/completions');
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, 'deepseek-flash');
  assert.deepEqual(body.thinking, { type: 'disabled' });
  assert.equal(body.response_format, undefined);
  assert.equal(body.tool_choice.function.name, 'ui_action');
  assert.equal(body.tools[0].function.name, 'ui_action');
  assert.match(body.messages[0].content[0].text, /Save/);
  assert.match(body.messages[0].content[1].image_url.url, /data:image\/png;base64,abc123/);
});

test('semantic hybrid mode admits candidate IDs and does not synthesize coordinates', async () => {
  let request;
  const driver = createVolcengineHybridDriver({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3.7-flash', CUA_API_KEY: 'test-key', CUA_HYBRID_ACTION_MODE: 'semantic' },
    observeHybrid: async () => ({ screenshot: 'abc123', pageStructure: { controls: [{ target_id: 'c12', role: 'link', name: 'New Page' }] } }),
    executeAction: async () => {},
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, status: 200, async json() { return { choices: [{ message: { tool_calls: [{ function: { name: 'ui_action', arguments: '{"action_type":"click","target_id":"c12"}' } }] } }] }; } };
    }
  });
  const decision = await driver.decide({ intent: 'Open New Page', observation: await driver.observe(), step: 0 });
  assert.deepEqual(decision.action, { type: 'click', target_id: 'c12' });
  assert.match(JSON.parse(request.options.body).messages[0].content[0].text, /target_id/);
});

test('hybrid driver permits a repeated coordinate after a screenshot transition', async () => {
  let screenshot = 'before';
  const driver = createVolcengineHybridDriver({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3-vl-flash', CUA_API_KEY: 'test-key', CUA_MAX_DECISION_RETRIES: '0' },
    observeHybrid: async () => ({ screenshot, pageStructure: { controls: [] } }),
    executeAction: async () => {},
    fetchImpl: async () => ({ ok: true, status: 200, async json() { return { choices: [{ message: { tool_calls: [{ function: { name: 'ui_action', arguments: '{"action_type":"click","x":20,"y":30}' } }] } }] }; } })
  });
  const firstObservation = await driver.observe();
  await driver.decide({ intent: 'Navigate', observation: firstObservation, step: 0 });
  screenshot = 'after';
  const secondObservation = await driver.observe();
  const second = await driver.decide({ intent: 'Navigate', observation: secondObservation, step: 1 });
  assert.equal(second.type, 'action');
});

test('semantic hybrid guard compares target ids instead of undefined coordinates', async () => {
  let calls = 0;
  const driver = createVolcengineHybridDriver({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3.7-flash', CUA_API_KEY: 'test-key', CUA_HYBRID_ACTION_MODE: 'semantic', CUA_MAX_DECISION_RETRIES: '0' },
    observeHybrid: async () => ({ screenshot: 'same', pageStructure: { controls: [{ target_id: 'c12', role: 'link', name: 'New Page' }] } }),
    executeAction: async () => {},
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, async json() { return { choices: [{ message: { tool_calls: [{ function: { name: 'ui_action', arguments: '{"action_type":"click","target_id":"c12"}' } }] } }] }; } };
    }
  });
  const observation = await driver.observe();
  await driver.decide({ intent: 'Navigate', observation, step: 0 });
  await assert.rejects(() => driver.decide({ intent: 'Navigate', observation, step: 1 }), /target_id=c12/);
  assert.equal(calls, 2);
});

test('semantic hybrid repeated textbox click instructs the model to type', async () => {
  const requests = [];
  const driver = createVolcengineHybridDriver({
    env: { CUA_PROVIDER: 'aliyun', CUA_MODEL: 'qwen3.7-flash', CUA_API_KEY: 'test-key', CUA_HYBRID_ACTION_MODE: 'semantic', CUA_MAX_DECISION_RETRIES: '1' },
    observeHybrid: async () => ({ screenshot: 'same', pageStructure: { controls: [{ target_id: 'c11', role: 'textbox', interaction: 'type', name: 'Page Title' }] } }),
    executeAction: async () => {},
    fetchImpl: async (url, options) => {
      requests.push(JSON.parse(options.body));
      return { ok: true, status: 200, async json() { return { choices: [{ message: { tool_calls: [{ function: { name: 'ui_action', arguments: '{"action_type":"click","target_id":"c11"}' } }] } }] }; } };
    }
  });
  const observation = await driver.observe();
  await driver.decide({ intent: 'Set the page title to PSS Phase2 Page', observation, step: 0 });
  await assert.rejects(() => driver.decide({ intent: 'Set the page title to PSS Phase2 Page', observation, step: 1 }), /textbox click.*target_id=c11/);
  assert.ok(requests.some((body) => body.messages[0].content[0].text.includes('next action MUST be a type action')));
});
