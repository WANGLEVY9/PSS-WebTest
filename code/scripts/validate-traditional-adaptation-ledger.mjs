#!/usr/bin/env node
/** Fail-closed validator for the outcome-blind Traditional adaptation ledger. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const protocolRoot = path.join(repoRoot, 'research', 'protocol');
const includedPath = path.join(protocolRoot, 'included_tasks.csv');
const adaptationPath = path.join(protocolRoot, 'traditional_adaptation_ledger.csv');
const REQUIRED = ['benchmark', 'benchmark_version', 'task_id', 'author_pseudonym', 'official_instruction_digest', 'script_path', 'script_hash', 'authoring_minutes', 'debugging_minutes', 'review_minutes', 'loc', 'locator_count', 'assertion_count', 'debug_edit_count', 'semantic_review_status', 'black_box_conformance_status', 'freeze_timestamp', 'notes'];
const REVIEW = new Set(['PASS', 'FAIL', 'PENDING']);

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const parse = (line) => {
    const cells = []; let current = ''; let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"' && line[i + 1] === '"' && quoted) { current += '"'; i += 1; continue; }
      if (char === '"') { quoted = !quoted; continue; }
      if (char === ',' && !quoted) { cells.push(current); current = ''; continue; }
      current += char;
    }
    cells.push(current); return cells;
  };
  const headers = parse(lines[0]);
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, parse(line)[index] ?? ''])));
}

const identity = (row) => `${row.benchmark}|${row.benchmark_version}|${row.task_id}|${row.official_instruction_digest}`;

export function auditTraditionalAdaptationLedger({ includedTasks, adaptationRows }) {
  const errors = [];
  const required = new Set(REQUIRED);
  for (const row of includedTasks) for (const field of ['benchmark', 'benchmark_version', 'task_id', 'task_instruction_digest']) if (!row[field]) errors.push(`included task missing ${field}`);
  const seen = new Set();
  for (const row of adaptationRows) {
    for (const field of REQUIRED) if (!(field in row)) errors.push(`adaptation row missing column ${field}`);
    const key = identity(row);
    if (seen.has(key)) errors.push(`duplicate adaptation row: ${key}`);
    seen.add(key);
    if (!/^[a-f0-9]{64}$/.test(row.official_instruction_digest ?? '')) errors.push(`invalid instruction digest: ${key}`);
    if (!/^[a-f0-9]{64}$/.test(row.script_hash ?? '')) errors.push(`invalid script hash: ${key}`);
    for (const field of ['authoring_minutes', 'debugging_minutes', 'review_minutes', 'loc', 'locator_count', 'assertion_count', 'debug_edit_count']) {
      if (!/^\d+(?:\.\d+)?$/.test(String(row[field] ?? ''))) errors.push(`non-negative numeric ${field} required: ${key}`);
    }
    if (!REVIEW.has(row.semantic_review_status)) errors.push(`semantic_review_status must be PASS, FAIL, or PENDING: ${key}`);
    if (!REVIEW.has(row.black_box_conformance_status)) errors.push(`black_box_conformance_status must be PASS, FAIL, or PENDING: ${key}`);
    if (!row.freeze_timestamp) errors.push(`freeze_timestamp required: ${key}`);
  }
  const includedKeys = new Set(includedTasks.map((row) => `${row.benchmark}|${row.benchmark_version}|${row.task_id}|${row.task_instruction_digest}`));
  for (const key of seen) if (!includedKeys.has(key)) errors.push(`adaptation row is not in the frozen included task set: ${key}`);
  for (const key of includedKeys) if (!seen.has(key)) errors.push(`missing Traditional adaptation row: ${key}`);
  const complete = errors.length === 0 && includedTasks.length > 0 && adaptationRows.length === includedTasks.length && adaptationRows.every((row) => row.semantic_review_status !== 'PENDING' && row.black_box_conformance_status !== 'PENDING');
  return { status: complete ? 'traditional-adaptation-complete-pending-script-freeze' : (includedTasks.length ? 'traditional-adaptation-pending' : 'blocked-by-screening'), confirmatory_authorized: false, included_task_count: includedTasks.length, adaptation_row_count: adaptationRows.length, errors };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = auditTraditionalAdaptationLedger({ includedTasks: parseCsv(fs.readFileSync(includedPath, 'utf8')).map((row) => ({ ...row, task_instruction_digest: row.task_instruction_digest || row.official_instruction_digest })), adaptationRows: parseCsv(fs.readFileSync(adaptationPath, 'utf8')) });
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length || result.status !== 'traditional-adaptation-complete-pending-script-freeze') process.exitCode = 2;
}
