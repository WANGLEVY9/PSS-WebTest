import { validateRunRecord } from './run-records.mjs';

function rate(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

function strictPass(record) {
  return record.status === 'completed'
    && record.checkpoint_reached === true
    && (record.emitted_verdict === 'clean' || record.emitted_verdict === 'fault')
    && record.emitted_verdict === record.ground_truth_verdict;
}

/** Retain unknown/not-emitted fault outcomes as false negatives and expose coverage separately. */
export function summarizePairedCleanFault(records) {
  const groups = new Map();
  for (const raw of records) {
    const record = validateRunRecord(raw);
    if (!['clean', 'fault'].includes(record.ground_truth_verdict)) continue;
    const key = `${record.application_id}\u0000${record.task_id}\u0000${record.arm}`;
    const group = groups.get(key) ?? { application_id: record.application_id, task_id: record.task_id, arm: record.arm, records: [] };
    group.records.push(record);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const clean = group.records.filter((record) => record.ground_truth_verdict === 'clean');
    const fault = group.records.filter((record) => record.ground_truth_verdict === 'fault');
    if (!clean.length || !fault.length) throw new Error(`${group.application_id}/${group.task_id}/${group.arm} lacks a paired clean or fault stratum`);
    const emitted = group.records.filter((record) => ['clean', 'fault'].includes(record.emitted_verdict));
    const falsePositives = clean.filter((record) => record.emitted_verdict === 'fault').length;
    const falseNegatives = fault.filter((record) => record.emitted_verdict !== 'fault').length;
    const sensitivity = rate(fault.filter((record) => record.emitted_verdict === 'fault').length, fault.length);
    const specificity = rate(clean.filter((record) => record.emitted_verdict === 'clean').length, clean.length);
    const failureCategories = {};
    for (const record of group.records) if (record.failure_category) failureCategories[record.failure_category] = (failureCategories[record.failure_category] ?? 0) + 1;
    return {
      application_id: group.application_id, task_id: group.task_id, arm: group.arm,
      clean_n: clean.length, fault_n: fault.length,
      strict_correct_n: group.records.filter(strictPass).length,
      strict_correct_rate: rate(group.records.filter(strictPass).length, group.records.length),
      verdict_coverage_n: emitted.length,
      verdict_coverage_rate: rate(emitted.length, group.records.length),
      false_positive_n: falsePositives, false_positive_rate: rate(falsePositives, clean.length),
      false_negative_n: falseNegatives, false_negative_rate: rate(falseNegatives, fault.length),
      sensitivity, specificity, balanced_accuracy: (sensitivity + specificity) / 2,
      failure_categories: failureCategories
    };
  }).sort((left, right) => left.arm.localeCompare(right.arm));
}

function percent(value) { return value === null ? '—' : `${(value * 100).toFixed(1)}%`; }

export function renderPairedCleanFaultReport(summary, { generatedAt = new Date().toISOString() } = {}) {
  const rows = summary.map((row) => `| ${row.arm} | ${row.clean_n} | ${row.fault_n} | ${row.strict_correct_n}/${row.clean_n + row.fault_n} | ${percent(row.strict_correct_rate)} | ${row.verdict_coverage_n}/${row.clean_n + row.fault_n} | ${percent(row.verdict_coverage_rate)} | ${percent(row.false_positive_rate)} | ${percent(row.false_negative_rate)} | ${percent(row.sensitivity)} | ${percent(row.specificity)} | ${percent(row.balanced_accuracy)} | ${Object.keys(row.failure_categories).length ? Object.entries(row.failure_categories).map(([key, value]) => `${key}:${value}`).join(', ') : 'none'} |`).join('\n');
  return `# BookStack create-page paired clean/fault pilot — 2026-09-04\n\n**Generated:** ${generatedAt}  \n**Scope:** Phase 2 feasibility/admission pilot; this is not confirmatory evidence.\n\n| Arm | Clean n | Fault n | Strict correct | Strict rate | Verdict coverage | Coverage rate | FPR | FNR | Sensitivity | Specificity | Balanced accuracy | Failure categories |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|\n${rows}\n\nDefinitions follow metric-dictionary.v0.1: FPR is clean runs reported as fault; FNR is fault runs reported as clean, unknown, or not-emitted. All runs stay in the denominator. Verdict coverage is shown separately because a non-emitted verdict is an end-to-end failure, not a reason to discard a run. With n=3 per condition/arm and a single task/model stratum, these values are descriptive pilot diagnostics only; do not infer a general arm ranking.\n`;
}
