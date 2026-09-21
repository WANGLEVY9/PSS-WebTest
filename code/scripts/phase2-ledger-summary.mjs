#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
// Build a reproducible descriptive summary from the append-only Phase 2
// ledgers. This is a pilot/diagnostic artifact; it never authorizes
// confirmatory collection and never pools model/framework strata implicitly.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';
import { validateRunRecordAgainstRegistry } from '../src/run-records.mjs';
import { readDeduplicatedJsonl } from '../src/ledger-files.mjs';
import { executionVariant } from '../src/execution-variant.mjs';

const codeRoot = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const repoRoot = path.resolve(codeRoot, '..');
const args = process.argv.slice(2);
const value = (flag, fallback = null) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const applicationFilter = value('--application');
const outputPath = value('--output');
const legacyModels = new Set(['qwen3-vl-flash']);
const roots = [path.join(repoRoot, 'artifacts/phase2'), path.join(codeRoot, 'artifacts/phase2')];
const registry = loadConfigurationRegistry();

const strictPass = (record) => record.status === 'completed'
  && record.checkpoint_reached === true
  && record.emitted_verdict === record.ground_truth_verdict;

const ledgerInput = readDeduplicatedJsonl(roots, { repoRoot });
const files = ledgerInput.files;
const valid = [];
const invalid = [...ledgerInput.invalid];
for (const entry of ledgerInput.entries) {
    let raw = null;
    try {
      raw = entry.raw;
      const record = validateRunRecordAgainstRegistry(raw, registry);
      if (!applicationFilter || record.application_id === applicationFilter) valid.push({ file: entry.file, record });
    } catch (error) {
      invalid.push({ file: entry.file, line: entry.line, application_id: raw?.application_id ?? null, error: error.message });
    }
}

const grouped = new Map();
const keyOf = (record) => [
  record.application_id,
  record.task_id,
  record.condition,
  record.arm,
  record.provenance?.provider_id ?? 'scripted',
  record.provenance?.model_id ?? 'scripted',
  executionVariant(record)
].join('|');
for (const entry of valid) {
  const key = keyOf(entry.record);
  const group = grouped.get(key) ?? { records: [], ...Object.fromEntries([
    ['application_id', entry.record.application_id],
    ['task_id', entry.record.task_id],
    ['condition', entry.record.condition],
    ['arm', entry.record.arm],
    ['provider_id', entry.record.provenance?.provider_id ?? null],
    ['model_id', entry.record.provenance?.model_id ?? null],
    ['execution_variant', executionVariant(entry.record)]
  ]) };
  group.records.push(entry.record);
  grouped.set(key, group);
}

const groups = [...grouped.values()].sort((left, right) => keyOf({ ...left, provenance: { provider_id: left.provider_id, model_id: left.model_id }, arm: left.arm }).localeCompare(keyOf({ ...right, provenance: { provider_id: right.provider_id, model_id: right.model_id }, arm: right.arm })));
const summaries = groups.map((group) => {
  const rows = group.records;
  const failureCategories = {};
  for (const row of rows) if (row.failure_category) failureCategories[row.failure_category] = (failureCategories[row.failure_category] ?? 0) + 1;
  const resetVerified = rows.filter((row) => typeof row.reset_digest === 'string' && row.reset_digest.length > 0).length;
  return {
    application_id: group.application_id,
    task_id: group.task_id,
    condition: group.condition,
    arm: group.arm,
    provider_id: group.provider_id,
    model_id: group.model_id,
    execution_variant: group.execution_variant,
    legacy_quarantined: legacyModels.has(group.model_id),
    n: rows.length,
    strict_passes: rows.filter(strictPass).length,
    strict_rate: rows.length ? rows.filter(strictPass).length / rows.length : null,
    reset_verified: resetVerified,
    reset_coverage: rows.length ? resetVerified / rows.length : null,
    failure_categories: failureCategories,
    mean_wall_time_ms: rows.length ? rows.map((row) => row.timing?.wall_time_ms).filter(Number.isFinite).reduce((sum, n) => sum + n, 0) / Math.max(rows.map((row) => row.timing?.wall_time_ms).filter(Number.isFinite).length, 1) : null,
    source_files: [...new Set(group.records.map((row) => row.run_id).filter(Boolean))].length
  };
});

const applications = [...new Set(valid.map(({ record }) => record.application_id))].sort();
const scopedInvalid = invalid.filter((entry) => !applicationFilter || entry.application_id === applicationFilter);
const summary = {
  schema_version: 'phase2-ledger-summary-v0.1',
  generated_at: new Date().toISOString(),
  status: 'pilot-diagnostic-not-confirmatory',
  confirmatory_authorized: false,
  application_filter: applicationFilter,
  ledger_roots: roots.map((root) => path.relative(repoRoot, root)),
  files_scanned: files,
  duplicate_run_ids_excluded: ledgerInput.duplicates.length,
  valid_records: valid.length,
  invalid_records: scopedInvalid.length,
  invalid_records_scanned: invalid.length,
  invalid_examples: scopedInvalid.slice(0, 25),
  applications,
  groups: summaries,
  notes: [
    'Strict pass means completed protocol, reached checkpoint, and emitted verdict equals the independent ground-truth verdict.',
    'Legacy qwen3-vl-flash is retained for traceability but excluded from live provider/model stratum decisions.',
    'Provider, model, framework, and application groups are descriptive strata; no pooled inferential claim is authorized.',
    'This artifact does not freeze repetitions, power, or confirmatory collection.'
  ]
};
if (outputPath) {
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
}
console.log(JSON.stringify({ status: 'ok', application_filter: applicationFilter, valid_records: valid.length, invalid_records: scopedInvalid.length, invalid_records_scanned: invalid.length, groups: summaries.length, output: outputPath ?? null }));
