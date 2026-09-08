#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const repositoryRoot = path.resolve(codeRoot, '..');
const defaultArtifactsDir = path.join(repositoryRoot, 'artifacts/phase2');
const defaultOutput = path.join(repositoryRoot, 'research/phase2-experiment-data-2026-09-04.md');
const CURRENT_NAVIGATION_NAME = /^bookstack-navigation-(clean-stable|ui-evolution-bookstack-layout-v1)-aliyun-qwen3-vl-flash-phase2-(clean|evolution)-v\d+-records\.jsonl$/;
const CURRENT_CREATE_PAGE_FAULT_NAME = /^bookstack-create-page-functional-fault-persistence-mismatch-aliyun-qwen3-vl-flash-phase2-fault-v1-records\.jsonl$/;
const CURRENT_CREATE_PAGE_CLEAN_NAME = /^bookstack-create-page-clean-stable-aliyun-qwen3-vl-flash-phase2-create-clean-v1-records\.jsonl$/;

function isCurrentLedger(file) {
  const name = path.basename(file);
  return CURRENT_NAVIGATION_NAME.test(name) || CURRENT_CREATE_PAGE_FAULT_NAME.test(name) || CURRENT_CREATE_PAGE_CLEAN_NAME.test(name);
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function formatNumber(value, digits = 0) {
  return value === null || value === undefined ? '—' : Number(value).toFixed(digits);
}

function markdownCell(value) {
  return String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
}

export function strictPass(record) {
  return record.status === 'completed'
    && record.checkpoint_reached === true
    && ['clean', 'fault'].includes(record.emitted_verdict)
    && record.emitted_verdict === record.ground_truth_verdict;
}

export function parseJsonl(filePath) {
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch (error) { throw new Error(`${path.basename(filePath)}:${index + 1} is not JSON: ${error.message}`); }
  });
}

export function summarizeCurrentRuns(files) {
  const records = files.flatMap((file) => parseJsonl(file).map((record) => ({ file, record })));
  const groups = new Map();
  for (const entry of records) {
    const { record } = entry;
    const key = `${record.task_id}\u0000${record.condition}\u0000${record.arm}`;
    const group = groups.get(key) ?? { task_id: record.task_id, condition: record.condition, arm: record.arm, records: [] };
    group.records.push(entry);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => left.task_id.localeCompare(right.task_id) || left.condition.localeCompare(right.condition) || left.arm.localeCompare(right.arm)).map((group) => {
    const values = group.records.map(({ record }) => record);
    const strict = values.filter(strictPass).length;
    const failures = values.filter((record) => record.failure_category).map((record) => record.failure_category);
    return {
      task_id: group.task_id,
      condition: group.condition,
      arm: group.arm,
      n: values.length,
      strict,
      strict_rate: values.length ? strict / values.length : null,
      mean_wall_time_ms: mean(values.map((record) => record.timing?.wall_time_ms).filter(Number.isFinite)),
      mean_actions: mean(values.map((record) => record.timing?.actions).filter(Number.isFinite)),
      mean_retries: mean(values.map((record) => record.timing?.retries).filter(Number.isFinite)),
      reset_digests: [...new Set(values.map((record) => record.reset_digest).filter(Boolean))],
      configurations: [...new Set(values.map((record) => record.configuration_id).filter(Boolean))],
      failures: [...new Set(failures)]
    };
  });
}

function legacyInventory(files) {
  return files.map((file) => {
    let records;
    try { records = parseJsonl(file); }
    catch (error) { return { file: path.basename(file), records: 'invalid', schemas: '—', reason: error.message }; }
    const schemas = [...new Set(records.map((record) => record.schema_version ?? 'missing'))].join(', ');
    const conditions = [...new Set(records.map((record) => record.condition ?? 'missing'))].join(', ');
    return { file: path.basename(file), records: records.length, schemas, conditions, reason: 'Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled.' };
  }).sort((left, right) => left.file.localeCompare(right.file));
}

export function buildEvidenceReport({ artifactsDir = defaultArtifactsDir, generatedAt = new Date().toISOString() } = {}) {
  const jsonlFiles = fs.readdirSync(artifactsDir).filter((name) => name.endsWith('.jsonl')).map((name) => path.join(artifactsDir, name));
  const currentFiles = jsonlFiles.filter(isCurrentLedger).sort();
  if (currentFiles.length !== 8) throw new Error(`expected eight current Phase 2 ledgers, found ${currentFiles.length}`);
  const current = summarizeCurrentRuns(currentFiles);
  const currentRecordCount = current.reduce((sum, row) => sum + row.n, 0);
  const currentPasses = current.reduce((sum, row) => sum + row.strict, 0);
  const historical = legacyInventory(jsonlFiles.filter((file) => !currentFiles.includes(file)));
  const rows = current.map((row) => `| ${markdownCell(row.task_id)} | ${markdownCell(row.condition)} | ${row.arm} | ${row.n} | ${row.strict}/${row.n} | ${formatNumber(row.strict_rate * 100, 1)}% | ${formatNumber(row.mean_wall_time_ms / 1000, 3)} | ${formatNumber(row.mean_actions, 2)} | ${formatNumber(row.mean_retries, 2)} | ${markdownCell(row.reset_digests.length === 1 ? row.reset_digests[0].slice(0, 12) : `${row.reset_digests.length} digests`)} | ${markdownCell(row.configurations.join(', '))} | ${markdownCell(row.failures.length ? row.failures.join(', ') : 'none')} |`).join('\n');
  const inventoryRows = historical.map((row) => `| ${markdownCell(row.file)} | ${row.records} | ${markdownCell(row.schemas)} | ${markdownCell(row.conditions)} | ${markdownCell(row.reason)} |`).join('\n');
  return [
    '# Phase 2 experiment data ledger — 2026-09-04', '',
    `**Generated:** ${generatedAt}  `,
    '**Scope:** BookStack feasibility/admission pilot. This ledger does not contain confirmatory estimates.', '',
    '## Evidence classification', '',
    '| Class | Inclusion rule | Interpretation |', '|---|---|---|',
    '| Current v0.2 admission evidence | phase2-clean-v*, phase2-evolution-v*, and separately tagged paired create-page clean/fault ledgers; registry-resolved records; all three arms; independent oracle; reset digest | Supports only narrow, workflow-and-condition-specific admission subgates |',
    '| Historical / excluded ledger | Any other JSONL artifact | Retained for traceability, diagnosis, or prior pilot context; never pooled into the current table |', '',
    '## Current v0.2 matched evidence', '',
    'Strict pass means **completed protocol + reached independent-oracle state + emitted verdict equals ground truth**. It is not merely a final page state or agent self-report.', '',
    '| Task | Condition | Arm | n | Strict passes | Strict rate | Mean wall time (s) | Mean actions | Mean retries | Reset digest prefix | Configuration | Failure categories |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|', rows, '',
    `**Current total:** ${currentPasses}/${currentRecordCount} strict passes across ${currentFiles.length} isolated ledgers. Every row has only n=3 per arm/condition; it is not evidence of a general success rate or arm superiority. The paired create-page clean/fault diagnostic is reported separately with verdict coverage; it remains a single-task pilot.`, '',
    '## Historical and excluded ledger inventory', '',
    'These files are intentionally not pooled with the table above. In particular, legacy schema versions, other provider/model strata, old run tags, tasks, and incomplete blocks retain their original denominators.', '',
    '| Ledger file | Records | Schema versions | Conditions | Why excluded from current aggregate |', '|---|---:|---|---|---|', inventoryRows || '| — | 0 | — | — | — |', '',
    '## Next evidence requirement', '',
    'The next scale gate is to reproduce this paired design across additional workflows and SUTs under P1. The navigation task CSS evolution evidence cannot be relabelled as fault evidence.'
  ].join('\n') + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  const output = outputIndex >= 0 ? path.resolve(args[outputIndex + 1]) : defaultOutput;
  const content = buildEvidenceReport();
  fs.writeFileSync(output, content, { mode: 0o600 });
  console.log(JSON.stringify({ status: 'ok', output, current_ledgers: 8 }));
}
