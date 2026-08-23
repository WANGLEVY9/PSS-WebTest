#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { validateRunRecord } from '../src/run-records.mjs';

const inputs = process.argv.slice(2);
if (inputs.length === 0) {
  console.error('usage: node scripts/audit-run-ledger.mjs <records.jsonl> [records.jsonl ...]');
  process.exit(2);
}

const records = [];
const errors = [];
for (const input of inputs) {
  const file = path.resolve(input);
  if (!fs.existsSync(file)) { errors.push(`${input}: file does not exist`); continue; }
  for (const [index, line] of fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).entries()) {
    try { records.push({ file: input, record: validateRunRecord(JSON.parse(line)) }); }
    catch (error) { errors.push(`${input}:${index + 1}: ${error.message}`); }
  }
}

const runIds = new Set();
const duplicateRunIds = [];
const byCell = new Map();
for (const { file, record } of records) {
  if (runIds.has(record.run_id)) duplicateRunIds.push(record.run_id);
  runIds.add(record.run_id);
  const cell = `${record.application_id}/${record.task_id}/${record.condition}`;
  const entry = byCell.get(cell) ?? { arms: {}, files: new Set() };
  entry.arms[record.arm] = entry.arms[record.arm] ?? { total: 0, completed: 0, failures: 0 };
  entry.arms[record.arm].total += 1;
  if (record.status === 'completed' && record.checkpoint_reached) entry.arms[record.arm].completed += 1;
  else entry.arms[record.arm].failures += 1;
  entry.files.add(file);
  byCell.set(cell, entry);
}
for (const [cell, entry] of byCell) {
  for (const arm of ['visual', 'hybrid', 'playwright']) {
    if (!entry.arms[arm]) errors.push(`${cell}: missing arm ${arm}`);
  }
}

const cells = Object.fromEntries([...byCell.entries()].map(([cell, entry]) => [cell, {
  arms: entry.arms,
  files: [...entry.files]
}]));
const summary = {
  status: errors.length || duplicateRunIds.length ? 'fail' : 'ok',
  records: records.length,
  unique_run_ids: runIds.size,
  duplicate_run_ids: [...new Set(duplicateRunIds)],
  cells,
  errors
};
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== 'ok') process.exitCode = 1;
