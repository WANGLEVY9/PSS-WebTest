import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const catalog = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config/application-expansion-catalog.v0.1.json'), 'utf8'));

test('application expansion catalog is fail-closed and broader than the current pilot inventory', () => {
  assert.equal(catalog.status, 'candidate-pool-not-admitted');
  assert.deepEqual(catalog.current_application_inventory.pilot_suts, ['bookstack', 'indico', 'juice-shop']);
  assert.deepEqual(catalog.current_application_inventory.admitted_for_confirmatory, []);
  const countable = catalog.candidate_applications.filter((app) => app.status !== 'role-only-not-an-application');
  assert.ok(countable.length >= 20, `expected at least 20 countable candidates, got ${countable.length}`);
  assert.ok(countable.every((app) => app.status === 'candidate-unverified'));
  assert.ok(countable.every((app) => app.version_pin === null));
});

test('cross-application tasks require explicit handoff and independent oracle layers', () => {
  assert.ok(catalog.cross_application_task_families.length >= 3);
  for (const task of catalog.cross_application_task_families) {
    assert.equal(task.status, 'candidate-unverified');
    assert.ok(task.handoff_contract.length >= 2);
    assert.ok(task.oracle_layers.length >= 2);
    assert.ok(task.admission_requires.includes('both-applications-admitted'));
    assert.ok(task.admission_requires.includes('shared-reset-coordinator'));
  }
});

test('role-only records cannot inflate application denominator', () => {
  const roleOnly = catalog.candidate_applications.filter((app) => app.status === 'role-only-not-an-application');
  assert.ok(roleOnly.length >= 1);
  assert.ok(roleOnly.every((app) => app.cross_app_roles.includes('do-not-count-as-application')));
});
