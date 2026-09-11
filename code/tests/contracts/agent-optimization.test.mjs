import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAgentOptimization } from '../../src/agent-optimization.mjs';

test('optimization profile raises reliability budgets without changing observation arms', () => {
  const visual = resolveAgentOptimization({ env: { PSS_AGENT_PROFILE: 'aliyun-qwen-grounded-v1' }, arm: 'visual', taskFamily: 'navigation' });
  const hybrid = resolveAgentOptimization({ env: { PSS_AGENT_PROFILE: 'aliyun-qwen-grounded-v1' }, arm: 'hybrid', taskFamily: 'cross-page-state' });
  assert.equal(visual.timeout_ms, 30000);
  assert.equal(visual.max_steps, 10);
  assert.equal(visual.prompt_profile, 'explicit-search-v1');
  assert.equal(hybrid.hybrid_action_mode, 'semantic');
  assert.equal(hybrid.max_steps, 20);
  assert.equal(hybrid.structure_items, 40);
});

test('baseline profile remains explicitly selectable for matched ablation', () => {
  const baseline = resolveAgentOptimization({ env: { PSS_AGENT_PROFILE: 'baseline-v0' }, arm: 'hybrid', taskFamily: 'navigation' });
  assert.equal(baseline.hybrid_action_mode, 'coordinate');
  assert.equal(baseline.timeout_ms, 15000);
  assert.equal(baseline.max_steps, 8);
  assert.equal(baseline.prompt_profile, 'legacy-v0');
});
