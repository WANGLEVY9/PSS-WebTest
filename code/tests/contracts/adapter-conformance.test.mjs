import assert from 'node:assert/strict';
import test from 'node:test';
import { runAgentAdapterConformance, runScriptedAdapterConformance } from '../../src/adapter-conformance.mjs';
import { loadConfigurationRegistry } from '../../src/configuration-registry.mjs';

const registry = loadConfigurationRegistry();

test('visual conformance accepts a registered screenshot-only configuration without an external provider', async () => {
  const seen = [];
  const report = await runAgentAdapterConformance({
    registry,
    configurationId: 'visual-pss-native-aliyun-qwen3-vl-flash-v2',
    driver: {
      async observe() { return { screenshot: 'sha256:conformance-visual', viewport: { width: 1280, height: 720 } }; },
      async decide({ step }) { return step === 0 ? { type: 'action', action: { type: 'click', x: 10, y: 20 } } : { type: 'done', verdict: 'clean' }; },
      async act(action) { seen.push(action); },
      getRetryCount() { return 0; }
    }
  });
  assert.equal(report.passed, true);
  assert.equal(report.observation_contract, 'screenshot-only');
  assert.deepEqual(report.admitted_fields, ['screenshot', 'viewport']);
  assert.equal(report.execution.actions, 1);
  assert.equal(seen.length, 1);
});

test('hybrid conformance rejects evaluator leakage before a decision is requested', async () => {
  let decideCalled = false;
  await assert.rejects(() => runAgentAdapterConformance({
    registry,
    configurationId: 'hybrid-pss-native-aliyun-qwen3-vl-flash-v2',
    driver: {
      async observe() { return { screenshot: 'sha256:conformance-hybrid', pageStructure: { role: 'main', goldOracle: 'hidden' } }; },
      async decide() { decideCalled = true; return { type: 'done', verdict: 'clean' }; },
      async act() {}
    }
  }), /goldOracle/);
  assert.equal(decideCalled, false);
});

test('scripted conformance admits only the declared script artifact and aggregate execution result', async () => {
  const report = await runScriptedAdapterConformance({
    registry,
    configurationId: 'scripted-playwright-accessibility-human-v2',
    observation: { scriptId: 'bookstack-create-page-playwright-v2', browserName: 'chromium' },
    async execute() { return { status: 'completed', actions: 6, retries: 0 }; }
  });
  assert.equal(report.passed, true);
  assert.deepEqual(report.admitted_fields, ['browserName', 'scriptId']);
});

test('scripted conformance rejects an evaluator field before executing the script', async () => {
  let executed = false;
  await assert.rejects(() => runScriptedAdapterConformance({
    registry,
    configurationId: 'scripted-playwright-accessibility-human-v2',
    observation: { scriptId: 'bookstack-create-page-playwright-v2', goldOracle: 'hidden' },
    async execute() { executed = true; return { status: 'completed', actions: 1, retries: 0 }; }
  }), /goldOracle/);
  assert.equal(executed, false);
});
