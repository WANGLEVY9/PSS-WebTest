#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { validateRunRecord } from '../src/run-records.mjs';

export function summarizeRecords(records) {
  const groups = new Map();
  for (const input of records) {
    const record = validateRunRecord(input);
    const key = `${record.application_id}/${record.task_id}/${record.condition}/${record.arm}`;
    const group = groups.get(key) ?? { key, records: [] };
    group.records.push(record);
    groups.set(key, group);
  }
  const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return [...groups.values()].map(({ key, records: group }) => {
    const valid = group.filter((record) => record.status === 'completed' && record.checkpoint_reached);
    // Only clean/fault truth labels are scorable. `unknown` and `not-scored`
    // represent intentionally unavailable truth, not a correct/incorrect verdict.
    const verdictScorable = group.filter((record) =>
      (record.emitted_verdict === 'clean' || record.emitted_verdict === 'fault') &&
      (record.ground_truth_verdict === 'clean' || record.ground_truth_verdict === 'fault')
    );
    const verdictCorrect = verdictScorable.filter((record) => record.emitted_verdict === record.ground_truth_verdict);
    const failures = {};
    for (const record of group) {
      if (record.failure_category) failures[record.failure_category] = (failures[record.failure_category] ?? 0) + 1;
    }
    const truthLabels = new Set(group.map((record) => record.ground_truth_verdict).filter((verdict) => verdict === 'clean' || verdict === 'fault'));
    return {
      cell: key,
      n: group.length,
      valid_completion_rate: valid.length / group.length,
      joint_end_to_end_correctness_rate: valid.filter((record) => verdictCorrect.includes(record)).length / group.length,
      verdict_correct_rate: verdictScorable.length ? verdictCorrect.length / verdictScorable.length : null,
      mean_wall_time_ms: mean(group.map((record) => record.timing.wall_time_ms)),
      median_wall_time_ms: median(group.map((record) => record.timing.wall_time_ms)),
      mean_action_count: mean(group.map((record) => record.timing.actions)),
      mean_retry_count: mean(group.map((record) => record.timing.retries)),
      failure_categories: failures,
      false_positive_rate: null,
      false_negative_rate: null,
      note: truthLabels.size === 2
        ? 'FPR/FNR require a paired classifier calculation across clean and fault runs; this per-condition summary leaves them null intentionally.'
        : `FPR/FNR require matched clean and fault records for the same workflow; null is intentional for ${truthLabels.has('fault') ? 'fault-only' : 'clean-only'} input.`
    };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  const inputs = args.flatMap((value, index) => value === '--input' && args[index + 1] ? [args[index + 1]] : []);
  const outputIndex = args.indexOf('--output');
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;
  if (!inputs.length || !outputPath) throw new Error('usage: node scripts/summarize-run-records.mjs --input records-a.jsonl [--input records-b.jsonl ...] --output summary.json');
  const records = inputs.flatMap((inputPath) => fs.readFileSync(inputPath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)));
  const summary = { schema_version: '0.1', metric_dictionary: 'metric-dictionary.v0.1', input_files: inputs, records: records.length, groups: summarizeRecords(records), generated_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ status: 'ok', input_files: inputs.length, records: records.length, groups: summary.groups.length, output: outputPath }));
}
