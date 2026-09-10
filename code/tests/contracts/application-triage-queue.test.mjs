import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const catalog = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config/application-expansion-catalog.v0.1.json'), 'utf8'));
const queue = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config/application-triage-queue.v0.1.json'), 'utf8'));

test('triage queue covers every countable candidate without admitting any application', () => {
  const countableIds = catalog.candidate_applications.filter((application) => application.status !== 'role-only-not-an-application').map((application) => application.id);
  const queuedIds = queue.waves.flatMap((wave) => wave.application_ids);
  assert.equal(queue.status, 'triage-only-not-admitted');
  assert.deepEqual([...new Set(queuedIds)].sort(), [...countableIds].sort());
  assert.equal(queue.candidate_status.length, countableIds.length);
});
