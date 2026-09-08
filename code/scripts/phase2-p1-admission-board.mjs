import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildP1AdmissionBoard, renderP1AdmissionBoard } from '../src/phase2-p1-admission-board.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(root, '..');
const benchmarkMatrix = JSON.parse(fs.readFileSync(path.join(root, 'config/benchmark-matrix.v0.1.json'), 'utf8'));
const scalingPlan = JSON.parse(fs.readFileSync(path.join(root, 'config/phase2-scaling-plan.v0.1.json'), 'utf8'));
const outputPath = process.argv[2] ?? path.join(repositoryRoot, 'research/phase2-p1-workflow-admission-board-2026-09-04.md');
const rendered = renderP1AdmissionBoard(buildP1AdmissionBoard({ benchmarkMatrix, scalingPlan }));
fs.writeFileSync(outputPath, rendered, { mode: 0o600 });
console.log(JSON.stringify({ output: outputPath, workflow_rows: 15, status: 'pre-collection' }));
