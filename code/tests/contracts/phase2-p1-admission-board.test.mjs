import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildP1AdmissionBoard, renderP1AdmissionBoard } from '../../src/phase2-p1-admission-board.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const benchmarkMatrix = JSON.parse(fs.readFileSync(path.join(root, 'config/benchmark-matrix.v0.1.json'), 'utf8'));
const scalingPlan = JSON.parse(fs.readFileSync(path.join(root, 'config/phase2-scaling-plan.v0.1.json'), 'utf8'));

test('P1 board covers fifteen planned workflows without promoting candidates to data', () => {
  const board = buildP1AdmissionBoard({ benchmarkMatrix, scalingPlan });
  assert.equal(board.rows.length, 15);
  assert.deepEqual(Object.fromEntries(['bookstack', 'indico', 'juice-shop'].map((application) => [application, board.rows.filter((row) => row.application === application).length])), {
    bookstack: 5, indico: 5, 'juice-shop': 5
  });
  assert.equal(board.rows.some((row) => row.next_admission_gate.includes('confirmatory')), false);
  assert.match(renderP1AdmissionBoard(board), /675 planned runs/);
});
