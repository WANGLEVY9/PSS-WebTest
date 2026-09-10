import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { deriveLargeScaleInventory, validateLargeScaleExpansionPlan } from '../../src/large-scale-expansion.mjs';

const codeRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(codeRoot, relativePath), 'utf8'));
const plan = readJson('config/phase2-large-scale-expansion.v0.1.json');
const matrix = readJson('config/benchmark-matrix.v0.1.json');
const taskManifest = readJson('manifests/task-manifest.v0.1.json');

test('large-scale target expands to 2,160 cells and 30,240 executions', () => {
  assert.deepEqual(validateLargeScaleExpansionPlan(plan), []);
  assert.equal(plan.derived_totals.matched_cells, 2160);
  assert.equal(plan.derived_totals.execution_units, 30240);
  assert.equal(plan.derived_totals.per_strategy_execution_units, 10080);
});

test('current inventory is fail-closed and does not pretend to have 30 admitted applications', () => {
  const inventory = deriveLargeScaleInventory({ plan, benchmarkMatrix: matrix, taskManifest });
  assert.equal(inventory.ready_for_execution, false);
  assert.equal(inventory.current.declared_applications, 25);
  assert.equal(inventory.current.admitted_or_frozen_applications, 0);
  assert.match(inventory.blockers.join('\n'), /30/);
  assert.match(inventory.blockers.join('\n'), /power freeze/);
});

test('validator rejects a changed target without silently changing derived totals', () => {
  const invalid = structuredClone(plan);
  invalid.target.application_count = 29;
  assert.match(validateLargeScaleExpansionPlan(invalid).join('\n'), /matched_cells|execution_units|per_strategy/);
});
