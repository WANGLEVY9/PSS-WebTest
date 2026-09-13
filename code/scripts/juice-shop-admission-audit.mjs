#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';
import { validateRunRecordAgainstRegistry } from '../src/run-records.mjs';

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const manifest = JSON.parse(fs.readFileSync(`${root}/manifests/task-manifest.v0.1.json`, 'utf8'));
const application = manifest.applications.find((entry) => entry.id === 'juice-shop');
const tasks = application?.tasks?.map((task) => task.id) ?? [];
const conditions = ['clean-stable', 'functional-fault', 'ui-evolution'];
const arms = ['visual', 'hybrid', 'playwright'];
const minRepetitions = Number.parseInt(process.env.PSS_ADMISSION_MIN_REPETITIONS ?? '3', 10);
const artifactRoot = path.resolve(root, '../artifacts/phase2');
const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;

const files = fs.existsSync(artifactRoot)
  ? fs.readdirSync(artifactRoot).filter((name) => name.startsWith('juice-shop-three-arm-') && name.endsWith('-records.jsonl')).map((name) => path.join(artifactRoot, name))
  : [];
const registry = loadConfigurationRegistry();
const records = [];
const errors = [];
for (const file of files) {
  for (const [lineIndex, line] of fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).entries()) {
    try {
      const record = validateRunRecordAgainstRegistry(JSON.parse(line), registry);
      if (record.application_id === 'juice-shop' && tasks.includes(record.task_id)) records.push({ file: path.relative(process.cwd(), file), record });
    } catch (error) { errors.push(`${path.relative(process.cwd(), file)}:${lineIndex + 1}: ${error.message}`); }
  }
}

const strict = (record) => record.status === 'completed' && record.checkpoint_reached === true && record.emitted_verdict === record.ground_truth_verdict;
const key = (task, condition, arm) => `${task}|${condition}|${arm}`;
const cells = new Map();
for (const task of tasks) for (const condition of conditions) for (const arm of arms) cells.set(key(task, condition, arm), { task_id: task, condition, arm, n: 0, strict_passes: 0, reset_verified: 0, failure_categories: {} });
for (const { record } of records) {
  const cell = cells.get(key(record.task_id, record.condition, record.arm));
  if (!cell) continue;
  cell.n += 1;
  if (strict(record)) cell.strict_passes += 1;
  if (typeof record.reset_digest === 'string' && record.reset_digest.length > 0) cell.reset_verified += 1;
  if (record.failure_category) cell.failure_categories[record.failure_category] = (cell.failure_categories[record.failure_category] ?? 0) + 1;
}
const coverage = [...cells.values()];
const missing = coverage.filter((cell) => cell.n === 0);
const belowRepetition = coverage.filter((cell) => cell.n < minRepetitions);
const infrastructureOnly = coverage.filter((cell) => cell.n > 0 && cell.reset_verified === 0);
const summary = {
  schema_version: '0.1', application_id: 'juice-shop', status: missing.length || errors.length ? 'coverage-incomplete' : belowRepetition.length ? 'coverage-complete-repetition-incomplete' : infrastructureOnly.length ? 'infrastructure-incomplete' : 'admission-candidate',
  confirmatory_authorized: false, confirmatory_note: 'This audit never authorizes confirmatory collection; it only reports workflow coverage and pilot readiness.',
  task_count: tasks.length, tasks, conditions, arms, min_repetitions: minRepetitions,
  files, records: records.length, errors, missing_cells: missing, below_repetition_cells: belowRepetition, infrastructure_only_cells: infrastructureOnly,
  strict_passes: coverage.reduce((sum, cell) => sum + cell.strict_passes, 0),
  cells: coverage,
  branch_recommendation: missing.length ? 'BREADTH-BLOCKED: complete missing task/condition/arm cells before variance estimation.' : belowRepetition.length ? 'REPETITION-BLOCKED: increase matched repetitions without changing task, oracle, provider, or arm definitions.' : infrastructureOnly.length ? 'INFRASTRUCTURE-BLOCKED: repair reset/provenance cells before capability interpretation.' : 'PILOT-COVERAGE-COMPLETE: freeze analysis inputs and run preregistered variance/power simulation; do not start confirmatory collection automatically.'
};
if (outputPath) { fs.mkdirSync(path.dirname(outputPath), { recursive: true }); fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 }); }
console.log(JSON.stringify(summary, null, 2));
