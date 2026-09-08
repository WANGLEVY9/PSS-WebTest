import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readBlockPilotSummary } from '../../src/exploratory-batch-artifacts.mjs';

test('batch artifact reader treats the controller summary as the authority for three-arm completeness', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pss-batch-artifact-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'bookstack-tag-0001-pilot.json'), JSON.stringify({ records: [{ arm: 'visual', cell_passed: false }, { arm: 'hybrid', cell_passed: true }, { arm: 'playwright', cell_passed: true }] }));
  const evidence = readBlockPilotSummary({ artifactRoot: root, runTag: 'tag-0001', requiredArms: ['visual', 'hybrid', 'playwright'] });
  assert.equal(evidence.fullThreeArmRecord, true);
  assert.equal(evidence.strictPassedCells, 2);
});
