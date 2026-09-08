import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { validateExploratoryBatchPlan } from '../../scripts/validate-exploratory-batch-plan.mjs';

const codeRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const plan = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config/exploratory-500-block-campaign.v0.1.json'), 'utf8'));

test('exploratory 500-block campaign preserves exact three-arm accounting and fail-closed guardrails', () => {
  assert.deepEqual(validateExploratoryBatchPlan(plan), []);
  assert.equal(plan.target_matched_blocks, 500);
  assert.equal(plan.target_execution_units, 1500);
  assert.deepEqual([...plan.arms].sort(), ['hybrid', 'playwright', 'visual']);
});

test('exploratory campaign rejects an inflated total or missing provider cap', () => {
  const invalid = structuredClone(plan);
  invalid.target_execution_units = 500;
  invalid.resource_guardrails.requires_explicit_provider_request_cap = false;
  const errors = validateExploratoryBatchPlan(invalid).join('\n');
  assert.match(errors, /target_execution_units/);
  assert.match(errors, /fail-closed/);
});
