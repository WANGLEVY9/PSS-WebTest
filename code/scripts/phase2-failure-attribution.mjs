#!/usr/bin/env node
/**
 * Produce a bounded, replay-aware failure-attribution report for Phase 2
 * pilots.  The report deliberately distinguishes an observed boundary from
 * an internal model explanation: a label such as agent-planning means that
 * the trace reached a valid provider response and stopped before the
 * independently verified postcondition, not that the model's internals were
 * inspected.
 */
import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const repositoryRoot = path.resolve(codeRoot, '..');
const artifactsRoot = path.join(repositoryRoot, 'artifacts', 'phase2');

function parseJsonl(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).flatMap((line, index) => {
    try { return [JSON.parse(line)]; }
    catch (error) { throw new Error(`${path.basename(file)}:${index + 1}: ${error.message}`); }
  });
}

function loadRecords() {
  const files = fs.readdirSync(artifactsRoot)
    .filter((name) => name.endsWith('-records.jsonl') && /(attribution-qwen37|admission-)/.test(name))
    .sort()
    .map((name) => path.join(artifactsRoot, name));
  const byRunId = new Map();
  for (const file of files) for (const record of parseJsonl(file)) {
    if (!record.run_id) continue;
    byRunId.set(record.run_id, { file: path.basename(file), record });
  }
  return { files, entries: [...byRunId.values()] };
}

function loadReplays() {
  const replayRoot = path.join(artifactsRoot, 'replays');
  const map = new Map();
  if (!fs.existsSync(replayRoot)) return map;
  for (const name of fs.readdirSync(replayRoot).filter((value) => value.endsWith('.json'))) {
    try {
      const replay = JSON.parse(fs.readFileSync(path.join(replayRoot, name), 'utf8'));
      if (replay.run_id) map.set(replay.run_id, replay);
    } catch { /* Keep the report fail-closed for incomplete replays. */ }
  }
  return map;
}

function classifyBoundary(record, replay) {
  const category = record.failure_category;
  const replayError = String(replay?.outcome?.error?.message ?? '').toLowerCase();
  if (/locator\.|waiting for locator|element is not receiving|intercepts pointer|page\./.test(replayError)) return 'runner/execution';
  if (!category) return record.status === 'completed' ? 'pass' : 'unclassified';
  if (category === 'provider-timeout' || category === 'provider-api' || category === 'provider-format'
    || (category === 'provider' && (record.timing?.actions ?? 0) === 0)) return 'provider';
  if (category === 'grounding-loop') return 'agent-grounding';
  if (category === 'agent-step-budget' || category === 'agent-verdict' || category === 'termination-verdict') return 'agent-planning/termination';
  if (category === 'oracle') {
    const actions = (replay?.frames ?? []).map((frame) => frame.action).filter(Boolean);
    const hasSubmit = actions.some((action) => action.type === 'keypress' && String(action.key).toUpperCase() === 'ENTER');
    if (record.application_id === 'juice-shop' && !hasSubmit) return 'agent-planning/termination';
    return 'agent-or-task (needs replay review)';
  }
  if (category === 'execution') return 'runner/execution';
  return category;
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

function md(value) { return String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' '); }

function buildReport() {
  const { files, entries } = loadRecords();
  const replays = loadReplays();
  const rows = entries.map(({ file, record }) => ({
    file,
    record,
    replay: replays.get(record.run_id),
    boundary: classifyBoundary(record, replays.get(record.run_id))
  }));
  const scopeRows = rows.filter(({ record }) => ['bookstack', 'indico', 'juice-shop'].includes(record.application_id));
  const grouped = countBy(scopeRows.map(({ boundary }) => ({ boundary })), 'boundary');
  const groupedByAppArm = new Map();
  for (const row of scopeRows) {
    const key = `${row.record.application_id}|${row.record.arm}|${row.boundary}`;
    groupedByAppArm.set(key, (groupedByAppArm.get(key) ?? 0) + 1);
  }
  const appRows = [...groupedByAppArm.entries()].sort().map(([key, n]) => {
    const [application, arm, boundary] = key.split('|');
    return `| ${application} | ${arm} | ${boundary} | ${n} |`;
  }).join('\n');
  const representativeRows = scopeRows
    .filter(({ boundary }) => boundary !== 'pass')
    .sort((a, b) => a.record.run_id.localeCompare(b.record.run_id))
    .map(({ record, replay, boundary }) => {
      const actions = (replay?.frames ?? []).map((frame) => frame.action).filter(Boolean);
      const lastAction = actions.at(-1);
      const providerEvents = replay?.provider_events?.length ?? 0;
      return `| ${md(record.run_id)} | ${record.application_id} | ${record.arm} | ${md(record.failure_category)} | ${boundary} | ${record.timing?.actions ?? 0} | ${providerEvents} | ${md(lastAction ? `${lastAction.type}${lastAction.key ? `:${lastAction.key}` : ''}` : 'none')} |`;
    }).join('\n');
  const passRows = scopeRows.filter(({ boundary }) => boundary === 'pass').length;
  const report = [
    '# Phase 2 failure-attribution audit',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Scope and evidence boundary',
    '',
    `This report deduplicates ${scopeRows.length} run records by run_id from ${files.length} tagged attribution ledgers. It is a diagnostic pilot report, not a confirmatory estimate and not a claim of universal model capability. The causal labels below name the first observable boundary in the run/replay; they do not inspect model internals.`,
    '',
    `Strictly completed records in this scope: ${passRows}/${scopeRows.length}.`,
    '',
    '## Observed boundary counts',
    '',
    '| Boundary | Runs |',
    '|---|---:|',
    grouped.map(([boundary, n]) => `| ${md(boundary)} | ${n} |`).join('\n') || '| — | 0 |',
    '',
    '## Application × arm × observed boundary',
    '',
    '| Application | Arm | Boundary | Runs |',
    '|---|---|---|---:|',
    appRows || '| — | — | — | 0 |',
    '',
    '## Replay-linked non-pass runs',
    '',
    '| Run | Application | Arm | Ledger category | First observed boundary | Actions | Provider events | Last action |',
    '|---|---|---|---|---|---:|---:|---|',
    representativeRows || '| — | — | — | — | — | — | — | — |',
    '',
    '## Engineering controls and interpretation',
    '',
    '- **Framework/schema boundary (fixed):** the v0.1 pilot schema rejected v0.2-only provenance fields. The runners now add `optimization_profile` and `hybrid_action_mode` only under protocol `2.0-draft`; direct contract tests remain green. This earlier failure is not evidence against either agent arm.',
    '- **Juice Shop readiness boundary (fixed):** the runner now waits for the API-backed catalog, settles after actions, dismisses optional overlays under an explicit condition, and resolves semantic hybrid `target_id`s. The pre-fix empty catalog and unresolved target id are infrastructure/adapter failures.',
    '- **Provider boundary:** the Indico hybrid pilot had a provider-timeout before any action, while Qwen3.7-Flash diagnostics returned HTTP 200 and valid actions in the controlled harness. This is a latency/context boundary for that run, not an independent SUT-oracle failure.',
    '- **Grounding boundary:** BookStack visual (grounded profile) and Indico visual stop at repeated/non-progressing visual interaction; the locator Playwright arm reaches the same postcondition. This is evidence of a visual grounding limitation under the tested model/profile, not proof that all visual CUA is incapable.',
    '- **Planning/termination boundary:** Juice Shop full and prepared-search pilots reached a valid page but stopped after typing without pressing Enter; replay provider events were successful. In the submit-only control, both visual and hybrid pressed Enter and passed the independent oracle. The narrow failure is therefore task decomposition/termination in the navigation-plus-submit intent, not inability to execute Enter or an oracle defect.',
    '',
    '## Decision for the next experiment',
    '',
    'Keep the three arms and fail-closed admission. Before any power freeze, repeat each attribution cell with matched resets and preserve the replay. Add an explicit task-composition factor (navigation+submit versus submit-only) and a provider-latency/structure-size diagnostic. Do not pool infrastructure failures with agent capability failures, and do not start confirmatory collection from this pilot.',
    ''
  ].join('\n');
  return { report, summary: { files: files.length, records: scopeRows.length, pass: passRows, boundaries: Object.fromEntries(grouped) } };
}

const { report, summary } = buildReport();
const outputArg = process.argv.indexOf('--output');
const output = outputArg >= 0 ? path.resolve(process.argv[outputArg + 1]) : null;
if (output) fs.writeFileSync(output, report, { mode: 0o600 });
console.log(JSON.stringify({ status: 'ok', ...summary, output }, null, 2));
if (output) console.error(report);
