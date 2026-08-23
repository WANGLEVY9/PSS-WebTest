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
    const verdictScorable = group.filter((record) => record.emitted_verdict !== 'not-emitted' && record.ground_truth_verdict !== null);
    const verdictCorrect = verdictScorable.filter((record) => record.emitted_verdict === record.ground_truth_verdict);
    const failures = {};
    for (const record of group) {
      if (record.failure_category) failures[record.failure_category] = (failures[record.failure_category] ?? 0) + 1;
    }
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
      note: 'FPR/FNR require matched clean and fault records; null is intentional for clean-only input.'
    };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const args = process.argv.slice(2);
  const get = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : null; };
  const inputPath = get('--input');
  const outputPath = get('--output');
  if (!inputPath || !outputPath) throw new Error('usage: node scripts/summarize-run-records.mjs --input records.jsonl --output summary.json');
  const records = fs.readFileSync(inputPath, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  const summary = { schema_version: '0.1', metric_dictionary: 'metric-dictionary.v0.1', records: records.length, groups: summarizeRecords(records), generated_at: new Date().toISOString() };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ status: 'ok', records: records.length, groups: summary.groups.length, output: outputPath }));
}
