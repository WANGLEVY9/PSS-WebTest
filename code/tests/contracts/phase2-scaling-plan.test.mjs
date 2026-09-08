import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { validateScalingPlan } from '../../scripts/validate-phase2-scaling-plan.mjs';

const codeRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const plan = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config/phase2-scaling-plan.v0.1.json'), 'utf8'));

test('scaling plan keeps broad coverage and validates its run-count arithmetic', () => {
  assert.deepEqual(validateScalingPlan(plan), []);
  assert.equal(plan.current_evidence.eligible_v0_2_records, 36);
  assert.equal(plan.current_evidence.workflows, 2);
  assert.equal(plan.near_term_panels.find((panel) => panel.id === 'P1-existing-sut-reference').expected_runs, 675);
});

test('scaling plan rejects a faux sample-size increase with inconsistent run counts', () => {
  const invalid = structuredClone(plan);
  invalid.near_term_panels[0].expected_runs = 999;
  assert.match(validateScalingPlan(invalid).join('\n'), /expected_runs/);
});
