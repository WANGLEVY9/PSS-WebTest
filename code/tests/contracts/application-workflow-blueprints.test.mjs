import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const catalog = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config/application-expansion-catalog.v0.1.json'), 'utf8'));
const plan = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config/application-workflow-blueprints.v0.1.json'), 'utf8'));

test('every countable candidate has eight explicit workflow slots', () => {
  const countable = catalog.candidate_applications.filter((application) => application.status !== 'role-only-not-an-application');
  assert.ok(countable.length >= 20);
  assert.equal(plan.status, 'candidate-workflow-pool-not-admitted');
  assert.equal(plan.workflow_slots.length, 8);
  assert.equal(plan.application_workflow_plan.length, countable.length);
  for (const application of plan.application_workflow_plan) {
    assert.equal(application.status, 'candidate-only');
    assert.equal(application.workflow_slots.length, 8);
    assert.equal(new Set(application.workflow_slots).size, 8);
  }
});
