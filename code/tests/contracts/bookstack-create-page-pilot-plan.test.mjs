import assert from 'node:assert/strict';
import test from 'node:test';
import { createBookStackCreatePagePilotPlan } from '../../src/bookstack-create-page-pilot-plan.mjs';

test('fault preflight fixes every cell, configuration, and external-call count before execution', () => {
  const plan = createBookStackCreatePagePilotPlan({
    condition: 'functional-fault:persistence-mismatch', repetitions: 3, runTag: 'phase2-fault-v1'
  });
  assert.equal(plan.totalCells, 9);
  assert.equal(plan.scriptedCells, 3);
  assert.equal(plan.externalModelCalls, 6);
  assert.equal(plan.conditionSpec.expectedVerdict, 'fault');
  assert.equal(plan.conditionSpec.applyFault, true);
  assert.equal(new Set(plan.cells.map((cell) => cell.randomizationBlock)).size, 3);
  assert.deepEqual(new Set(plan.cells.map((cell) => cell.configurationId)), new Set([
    'scripted-playwright-accessibility-human-v2',
    'visual-pss-native-aliyun-qwen3-7-flash-v1',
    'hybrid-pss-native-aliyun-qwen3-7-flash-v1'
  ]));
});

test('preflight rejects an unrecognised condition instead of silently changing the study stratum', () => {
  assert.throws(() => createBookStackCreatePagePilotPlan({ condition: 'fault' }), /Unsupported/);
});

test('evolution preflight fixes a presentation-only mutation while retaining the clean verdict', () => {
  const plan = createBookStackCreatePagePilotPlan({
    condition: 'ui-evolution:bookstack-layout-v1', repetitions: 1, runTag: 'evolution-preflight'
  });
  assert.equal(plan.conditionSpec.expectedVerdict, 'clean');
  assert.equal(plan.conditionSpec.applyFault, false);
  assert.equal(plan.conditionSpec.uiMutation, 'bookstack-layout-v1');
  assert.equal(plan.externalModelCalls, 2);
});
