#!/usr/bin/env node
// Construct the single, auditable pilot input used by the variance/power
// planning stage. This is not a confirmatory dataset and it never authorizes
// collection. Invalid records remain counted and are excluded from cells.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';
import { validateRunRecordAgainstRegistry } from '../src/run-records.mjs';
import { readDeduplicatedJsonl } from '../src/ledger-files.mjs';

const codeRoot = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const repoRoot = path.resolve(codeRoot, '..');
const args = process.argv.slice(2);
const arg = (flag, fallback = null) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const applicationFilter = arg('--application');
const outputPath = arg('--output');
const resetCompleteOnly = args.includes('--reset-complete-only');
const minimumRepetitions = Number.parseInt(arg('--minimum-repetitions', '3'), 10);
if (!Number.isInteger(minimumRepetitions) || minimumRepetitions < 1) throw new Error('minimum repetitions must be a positive integer');

const conditionFamily = (condition) => {
  if (condition === 'clean-stable') return 'clean-stable';
  if (String(condition).startsWith('functional-fault')) return 'functional-fault';
  if (String(condition).startsWith('ui-evolution')) return 'ui-evolution';
  return String(condition);
};
const legacyModels = new Set(['qwen3-vl-flash']);
const executionVariant = (record) => {
  const runner = String(record.provenance?.runner_version ?? 'unknown');
  if (record.arm === 'playwright') return record.provenance?.framework_id ?? 'playwright';
  const framework = record.provenance?.framework_id
    ?? (runner.includes('stagehand') ? 'stagehand' : runner.includes('browser-use') ? 'browser-use' : 'pss-native');
  const protocolVariant = runner.includes('bounded-json-repair') ? 'bounded-json-repair' : 'strict-provider-format';
  return `${framework}:${protocolVariant}`;
};
const roots = [path.join(repoRoot, 'artifacts/phase2'), path.join(codeRoot, 'artifacts/phase2')];
const ledgerInput = readDeduplicatedJsonl(roots, { repoRoot });
const files = ledgerInput.files;
const registry = loadConfigurationRegistry();
const records = [];
const invalid = [...ledgerInput.invalid];
for (const entry of ledgerInput.entries) {
    const file = path.resolve(repoRoot, entry.file);
    let raw = null;
    try {
      raw = entry.raw;
      const record = validateRunRecordAgainstRegistry(raw, registry);
      if (applicationFilter && record.application_id !== applicationFilter) continue;
      if (resetCompleteOnly && !(typeof record.reset_digest === 'string' && record.reset_digest.length > 0)) continue;
      records.push({
        application_id: record.application_id,
        task_id: record.task_id,
        condition: record.condition,
        condition_family: conditionFamily(record.condition),
        arm: record.arm,
        provider_id: record.provenance?.provider_id ?? null,
        model_id: record.provenance?.model_id ?? null,
        framework_id: record.provenance?.framework_id ?? record.provenance?.framework ?? null,
        execution_variant: executionVariant(record),
        run_id: record.run_id,
        strict_pass: record.status === 'completed' && record.checkpoint_reached === true && record.emitted_verdict === record.ground_truth_verdict,
        reset_verified: typeof record.reset_digest === 'string' && record.reset_digest.length > 0,
        failure_category: record.failure_category ?? null,
        wall_time_ms: Number.isFinite(record.timing?.wall_time_ms) ? record.timing.wall_time_ms : null
      });
    } catch (error) {
      if (!applicationFilter || raw?.application_id === applicationFilter) invalid.push({ file: entry.file, line: entry.line, application_id: raw?.application_id ?? null, error: error.message });
    }
}

const cellKey = (row) => [row.application_id, row.task_id, row.condition_family, row.arm, row.provider_id ?? 'scripted', row.model_id ?? 'scripted', row.execution_variant].join('|');
const cellMap = new Map();
for (const row of records) {
  const key = cellKey(row);
  const cell = cellMap.get(key) ?? { key, application_id: row.application_id, task_id: row.task_id, condition_family: row.condition_family, observed_conditions: new Set(), arm: row.arm, provider_id: row.provider_id, model_id: row.model_id, execution_variant: row.execution_variant, framework_ids: new Set(), records: [], failure_categories: {} };
  cell.observed_conditions.add(row.condition);
  if (row.framework_id) cell.framework_ids.add(row.framework_id);
  cell.records.push(row);
  if (row.failure_category) cell.failure_categories[row.failure_category] = (cell.failure_categories[row.failure_category] ?? 0) + 1;
  cellMap.set(key, cell);
}
const cells = [...cellMap.values()].map((cell) => {
  const n = cell.records.length;
  const strictPasses = cell.records.filter((row) => row.strict_pass).length;
  const resetVerified = cell.records.filter((row) => row.reset_verified).length;
  const legacyQuarantined = legacyModels.has(cell.model_id);
  return {
    key: cell.key,
    application_id: cell.application_id,
    task_id: cell.task_id,
    condition_family: cell.condition_family,
    observed_conditions: [...cell.observed_conditions].sort(),
    arm: cell.arm,
    provider_id: cell.provider_id,
    model_id: cell.model_id,
    execution_variant: cell.execution_variant,
    framework_ids: [...cell.framework_ids].sort(),
    legacy_quarantined: legacyQuarantined,
    n,
    strict_passes: strictPasses,
    strict_rate: n ? strictPasses / n : null,
    reset_verified: resetVerified,
    reset_complete: resetVerified === n,
    repetition_eligible: !legacyQuarantined && n >= minimumRepetitions && resetVerified === n,
    failure_categories: cell.failure_categories
  };
}).sort((left, right) => left.key.localeCompare(right.key));

const eligibleCells = cells.filter((cell) => cell.repetition_eligible);
// A three-arm comparison must be matched within application, workflow, and
// condition. For each live visual/hybrid model, pair those cells with the
// corresponding scripted Playwright cell. A complete set of eligible single
// arms is required before the block can enter power planning.
const liveModels = [...new Set(cells
  .filter((cell) => ['visual', 'hybrid'].includes(cell.arm) && cell.provider_id && cell.model_id && !cell.legacy_quarantined)
  .map((cell) => `${cell.provider_id}|${cell.model_id}|${cell.execution_variant}`))].sort();
const matchedBlocks = [];
for (const modelKey of liveModels) {
  const [provider_id, model_id, ...variantParts] = modelKey.split('|');
  const execution_variant = variantParts.join('|');
  const anchors = [...new Set(cells
    .filter((cell) => cell.provider_id === provider_id && cell.model_id === model_id && cell.execution_variant === execution_variant && ['visual', 'hybrid'].includes(cell.arm))
    .map((cell) => `${cell.application_id}|${cell.task_id}|${cell.condition_family}`))].sort();
  for (const anchor of anchors) {
    const [application_id, task_id, condition_family] = anchor.split('|');
    const visual = cells.find((cell) => cell.application_id === application_id && cell.task_id === task_id && cell.condition_family === condition_family && cell.arm === 'visual' && cell.provider_id === provider_id && cell.model_id === model_id && cell.execution_variant === execution_variant);
    const hybrid = cells.find((cell) => cell.application_id === application_id && cell.task_id === task_id && cell.condition_family === condition_family && cell.arm === 'hybrid' && cell.provider_id === provider_id && cell.model_id === model_id && cell.execution_variant === execution_variant);
    const playwright = cells.find((cell) => cell.application_id === application_id && cell.task_id === task_id && cell.condition_family === condition_family && cell.arm === 'playwright' && cell.provider_id === null && cell.model_id === null);
    const arms = { playwright: playwright ?? null, visual: visual ?? null, hybrid: hybrid ?? null };
    const missingArms = Object.entries(arms).filter(([, cell]) => !cell || !cell.repetition_eligible).map(([arm]) => arm);
    matchedBlocks.push({
      key: `${anchor}|${modelKey}`,
      application_id, task_id, condition_family, provider_id, model_id, execution_variant,
      eligible: missingArms.length === 0,
      missing_arms: missingArms,
      arms: Object.fromEntries(Object.entries(arms).map(([arm, cell]) => [arm, cell ? { n: cell.n, strict_passes: cell.strict_passes, reset_complete: cell.reset_complete, repetition_eligible: cell.repetition_eligible } : null]))
    });
  }
}
const matchedEligibleBlocks = matchedBlocks.filter((block) => block.eligible);
const byApplication = [...new Set(cells.map((cell) => cell.application_id))].sort().map((application_id) => {
  const rows = cells.filter((cell) => cell.application_id === application_id);
  return {
    application_id,
    cells: rows.length,
    eligible_cells: rows.filter((cell) => cell.repetition_eligible).length,
    valid_records: rows.reduce((sum, cell) => sum + cell.n, 0),
    strict_passes: rows.reduce((sum, cell) => sum + cell.strict_passes, 0)
  };
});
const summary = {
  schema_version: 'phase2-pilot-input-v0.1',
  generated_at: new Date().toISOString(),
  status: 'pilot-input-planning-only',
  confirmatory_authorized: false,
  application_filter: applicationFilter,
  reset_complete_only: resetCompleteOnly,
  minimum_repetitions: minimumRepetitions,
  legacy_models_quarantined: [...legacyModels],
  ledger_roots: roots.map((root) => path.relative(repoRoot, root)),
  files_scanned: files,
  duplicate_run_ids_excluded: ledgerInput.duplicates.length,
  valid_records: records.length,
  invalid_records: invalid.length,
  invalid_examples: invalid.slice(0, 25),
  applications: byApplication,
  cells,
  eligible_cells: eligibleCells.length,
  matched_blocks: matchedBlocks,
  matched_eligible_blocks: matchedEligibleBlocks.length,
  notes: [
    'A cell is application × workflow × condition-family × arm × provider/model.',
    'A cell is eligible only when it has the minimum repetitions, complete reset evidence, and no quarantined legacy model.',
    resetCompleteOnly ? 'This input was explicitly filtered to records carrying reset_digest; historical records without reset evidence were excluded rather than backfilled.' : 'Historical records without reset evidence remain visible and keep mixed cells ineligible.',
    'The input preserves provider/model/framework strata and does not pool them into a universal arm effect.',
    'Execution variants separate framework and provider-protocol repairs (for example bounded-json-repair) from strict provider-format runs; Playwright remains the scripted anchor for each variant.',
    'Power candidates are matched blocks with one eligible Playwright, visual, and hybrid cell for the same application, workflow, condition-family, and live model.',
    'This artifact is a planning input. It does not freeze repetition counts or authorize confirmatory collection.'
  ]
};
if (outputPath) {
  fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
}
console.log(JSON.stringify({ status: 'ok', application_filter: applicationFilter, valid_records: records.length, invalid_records: invalid.length, cells: cells.length, eligible_cells: eligibleCells.length, output: outputPath ?? null }));
