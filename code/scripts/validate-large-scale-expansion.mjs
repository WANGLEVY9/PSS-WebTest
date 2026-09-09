#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { deriveLargeScaleInventory, validateLargeScaleExpansionPlan } from '../src/large-scale-expansion.mjs';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(codeRoot, relativePath), 'utf8'));
const plan = readJson('config/phase2-large-scale-expansion.v0.1.json');
const benchmarkMatrix = readJson('config/benchmark-matrix.v0.1.json');
const taskManifest = readJson('manifests/task-manifest.v0.1.json');
const errors = validateLargeScaleExpansionPlan(plan);
if (errors.length) {
  console.error(`Large-scale expansion plan validation failed (${errors.length} error(s))`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const inventory = deriveLargeScaleInventory({ plan, benchmarkMatrix, taskManifest });
  console.log(JSON.stringify({ status: plan.status, ...inventory }, null, 2));
  if (!inventory.ready_for_execution) {
    console.log('Execution is intentionally not authorized: resolve every blocker and set the plan status to ready-for-confirmatory only after the preregistered gates pass.');
  }
}
