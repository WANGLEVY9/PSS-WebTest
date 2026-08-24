#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ARMS = ['playwright', 'visual', 'hybrid'];

function wilson(successes, n, z = 1.959963984540054) {
  if (!n) return { estimate: null, lower: null, upper: null };
  const p = successes / n;
  const denominator = 1 + (z ** 2) / n;
  const center = (p + (z ** 2) / (2 * n)) / denominator;
  const half = z * Math.sqrt((p * (1 - p) + (z ** 2) / (4 * n)) / n) / denominator;
  return { estimate: p, lower: Math.max(0, center - half), upper: Math.min(1, center + half) };
}

export function createPilotVarianceReport(pilot) {
  const records = Array.isArray(pilot.records) ? pilot.records : [];
  const repetitions = [...new Set(records.map((record) => record.repetition))].sort((a, b) => a - b);
  const arms = Object.fromEntries(ARMS.map((arm) => {
    const rows = records.filter((record) => record.arm === arm);
    const successes = rows.filter((record) => record.cell_passed === true).length;
    const resetFailures = rows.filter((record) => record.reset_ok !== true).length;
    const retryUsed = rows.filter((record) => record.reset_retry_used === true).length;
    const failureCategories = {};
    for (const row of rows) if (row.failure_category) failureCategories[row.failure_category] = (failureCategories[row.failure_category] ?? 0) + 1;
    return [arm, {
      n: rows.length,
      successes,
      success_rate: wilson(successes, rows.length),
      reset_failures: resetFailures,
      reset_retry_used: retryUsed,
      reset_retry_rate: rows.length ? retryUsed / rows.length : null,
      failure_categories: failureCategories
    }];
  }));
  const matchedRepetitions = repetitions.filter((repetition) => ARMS.every((arm) => records.some((record) => record.repetition === repetition && record.arm === arm && record.cell_passed === true)));
  return {
    schema_version: '0.1',
    application: pilot.application ?? null,
    task_id: pilot.task_id ?? null,
    condition: pilot.condition ?? 'unknown',
    mutation: pilot.mutation ?? null,
    repetitions,
    matched_successful_repetitions: matchedRepetitions,
    matched_success_rate: repetitions.length ? matchedRepetitions.length / repetitions.length : null,
    arms,
    confirmatory: false,
    planning_only: true,
    note: 'Wilson intervals and rates are descriptive pilot estimates. Do not freeze repetition counts or claim arm superiority from this report.'
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  const get = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
  const inputPath = get('--input');
  const outputPath = get('--output');
  if (!inputPath || !outputPath) throw new Error('usage: node scripts/pilot-variance-report.mjs --input pilot.json --output variance.json');
  const pilot = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const report = createPilotVarianceReport(pilot);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ status: 'ok', input: inputPath, output: outputPath, condition: report.condition }));
}
