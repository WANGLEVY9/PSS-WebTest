import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readBlockPilotSummary } from '../../src/exploratory-batch-artifacts.mjs';

test('batch artifact reader treats the controller summary as the authority for three-arm completeness', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pss-batch-artifact-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'bookstack-tag-0001-pilot.json'), JSON.stringify({ run_tag: 'tag-0001', records: [{ arm: 'visual', cell_passed: false }, { arm: 'hybrid', cell_passed: true }, { arm: 'playwright', cell_passed: true }] }));
  const evidence = readBlockPilotSummary({ artifactRoot: root, runTag: 'tag-0001', requiredArms: ['visual', 'hybrid', 'playwright'] });
  assert.equal(evidence.fullThreeArmRecord, true);
  assert.equal(evidence.strictPassedCells, 2);
});

test('batch artifact reader isolates same-tag summaries by provider, model, and task', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pss-batch-artifact-isolation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const records = [{ arm: 'visual', cell_passed: true }, { arm: 'hybrid', cell_passed: true }, { arm: 'playwright', cell_passed: true }];
  fs.writeFileSync(path.join(root, 'old-tag-0001-pilot.json'), JSON.stringify({ run_tag: 'tag-0001', provider: 'aliyun', model: 'qwen3-vl-flash', task_id: 'bookstack-create-page', records }));
  fs.writeFileSync(path.join(root, 'new-tag-0001-pilot.json'), JSON.stringify({ run_tag: 'tag-0001', provider: 'aliyun', model: 'qwen3.7-flash', task_id: 'bookstack-create-page', records }));
  const evidence = readBlockPilotSummary({
    artifactRoot: root, runTag: 'tag-0001', requiredArms: ['visual', 'hybrid', 'playwright'],
    expectedProvider: 'aliyun', expectedModel: 'qwen3.7-flash', expectedTaskId: 'bookstack-create-page'
  });
  assert.ok(evidence.summaryPath.endsWith('new-tag-0001-pilot.json'));
  assert.equal(evidence.fullThreeArmRecord, true);
});
