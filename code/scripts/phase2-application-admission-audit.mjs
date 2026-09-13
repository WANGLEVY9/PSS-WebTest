#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';
import { validateRunRecordAgainstRegistry } from '../src/run-records.mjs';

const codeRoot = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const repoRoot = path.resolve(codeRoot, '..');
const manifest = JSON.parse(fs.readFileSync(`${codeRoot}/config/phase2-application-admission-manifest.v0.1.json`, 'utf8'));
// Historical runners used two ledger roots.  Scan both explicitly rather than
// silently treating a migrated application as having zero evidence.
const artifactRoots = [
  path.join(repoRoot, 'artifacts/phase2'),
  path.join(codeRoot, 'artifacts/phase2')
];
const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
const { planned_workflows_per_application: plannedWorkflows, conditions, primary_arms: arms, minimum_primary_repetitions: minRepetitions, minimum_live_provider_repetitions: minProviderRepetitions } = manifest.target;
const legacyModels = new Set(manifest.legacy_models_quarantined ?? []);
const files = artifactRoots.flatMap((artifactRoot) => fs.existsSync(artifactRoot)
  ? fs.readdirSync(artifactRoot).filter((name) => name.endsWith('.jsonl')).map((name) => path.join(artifactRoot, name))
  : []);
const registry = loadConfigurationRegistry();
const records = [];
const invalid = [];
for (const file of files) {
  for (const [lineIndex, line] of fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).entries()) {
    try {
      const record = validateRunRecordAgainstRegistry(JSON.parse(line), registry);
      records.push({ file: path.relative(repoRoot, file), record });
    } catch (error) {
      invalid.push({ file: path.relative(repoRoot, file), line: lineIndex + 1, error: error.message });
    }
  }
}
const strict = (record) => record.status === 'completed' && record.checkpoint_reached === true && record.emitted_verdict === record.ground_truth_verdict;
const conditionFamily = (condition) => {
  if (condition === 'clean-stable') return 'clean-stable';
  if (String(condition).startsWith('functional-fault')) return 'functional-fault';
  if (String(condition).startsWith('ui-evolution')) return 'ui-evolution';
  return String(condition);
};
const conditionMatches = (recordCondition, expectedCondition) => conditionFamily(recordCondition) === expectedCondition;
const cellKey = (task, condition, arm) => `${task}|${condition}|${arm}`;
const result = [];
for (const app of manifest.applications) {
  const appRecords = records.filter(({ record }) => record.application_id === app.id).map(({ record }) => record);
  const expectedCells = app.implemented_tasks.flatMap((task) => conditions.flatMap((condition) => arms.map((arm) => ({ task, condition, arm }))));
  const cells = expectedCells.map(({ task, condition, arm }) => {
    const rows = appRecords.filter((record) => record.task_id === task && conditionMatches(record.condition, condition) && record.arm === arm);
    return {
      task_id: task, condition, arm, observed_conditions: [...new Set(rows.map((record) => record.condition))].sort(), n: rows.length,
      reset_verified: rows.filter((record) => typeof record.reset_digest === 'string' && record.reset_digest.length > 0).length,
      strict_passes: rows.filter(strict).length,
      failure_categories: Object.fromEntries([...new Set(rows.map((record) => record.failure_category).filter(Boolean))].map((category) => [category, rows.filter((record) => record.failure_category === category).length]))
    };
  });
  const providerStrata = new Map();
  for (const record of appRecords) {
    const provider = record.provenance?.provider_id ?? 'scripted';
    const model = record.provenance?.model_id ?? 'scripted';
    const family = conditionFamily(record.condition);
    const key = `${record.task_id}|${family}|${record.arm}|${provider}|${model}`;
    const row = providerStrata.get(key) ?? { task_id: record.task_id, condition: family, observed_conditions: new Set(), arm: record.arm, provider_id: record.provenance?.provider_id ?? null, model_id: record.provenance?.model_id ?? null, n: 0, strict_passes: 0 };
    row.observed_conditions.add(record.condition);
    row.n += 1;
    if (strict(record)) row.strict_passes += 1;
    providerStrata.set(key, row);
  }
  for (const row of providerStrata.values()) row.observed_conditions = [...row.observed_conditions].sort();
  const liveProviderStrataBelowMin = [...providerStrata.values()].filter((row) => row.provider_id !== null && !legacyModels.has(row.model_id) && row.n < minProviderRepetitions);
  const missingCells = cells.filter((cell) => cell.n === 0);
  const belowCells = cells.filter((cell) => cell.n < minRepetitions);
  const gateFailures = Object.entries(app.gates).filter(([, passed]) => passed !== true).map(([gate]) => gate);
  const workflowBreadthComplete = app.implemented_tasks.length >= plannedWorkflows;
  const pilotCoverageComplete = missingCells.length === 0 && belowCells.length === 0;
  const status = !workflowBreadthComplete ? 'blocked-workflow-breadth'
    : !pilotCoverageComplete ? 'blocked-ledger-coverage'
      : gateFailures.length ? 'blocked-gate'
        : liveProviderStrataBelowMin.length ? 'blocked-provider-strata'
          : 'pilot-admission-candidate';
  result.push({
    application_id: app.id, status, planned_workflows: plannedWorkflows, implemented_workflows: app.implemented_tasks.length,
    missing_workflow_slots: Math.max(0, plannedWorkflows - app.implemented_tasks.length), records: appRecords.length,
    invalid_records_excluded: invalid.filter((entry) => entry.file.includes('artifacts/phase2/')).length,
    expected_cells: cells.length, missing_cells: missingCells, below_repetition_cells: belowCells,
    provider_strata: [...providerStrata.values()], live_provider_strata_below_min: liveProviderStrataBelowMin,
    strict_passes: cells.reduce((sum, cell) => sum + cell.strict_passes, 0), gates: app.gates, gate_failures: gateFailures,
    note: app.note
  });
}
const summary = {
  schema_version: '0.1', manifest_id: manifest.id, status: result.every((row) => row.status === 'pilot-admission-candidate') ? 'all-pilot-admission-candidates' : 'one-or-more-applications-blocked',
  confirmatory_authorized: false, confirmatory_note: 'This audit is fail-closed and never authorizes confirmatory collection.',
  target: manifest.target, legacy_models_quarantined: [...legacyModels], files_scanned: files.map((file) => path.relative(repoRoot, file)), valid_records: records.length, invalid_records: invalid.length, invalid_record_examples: invalid.slice(0, 25), applications: result,
  next_branch: result.some((row) => row.status === 'pilot-admission-candidate') ? 'Review pilot-admission candidates, freeze variance inputs, and keep confirmatory collection blocked until preregistration.' : 'Repair the first blocking gate in each application, then rerun this audit.'
};
if (outputPath) { fs.mkdirSync(path.dirname(outputPath), { recursive: true }); fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 }); }
console.log(JSON.stringify(summary, null, 2));
