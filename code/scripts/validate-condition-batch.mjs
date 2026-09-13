#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const inputs = process.argv.slice(2);
if (!inputs.length) throw new Error('usage: node scripts/validate-condition-batch.mjs <records.jsonl> ...');
const groups = new Map();
const errors = [];
for (const input of inputs) {
  const file = path.resolve(input);
  if (!fs.existsSync(file)) { errors.push(`${input}: missing file`); continue; }
  for (const [index, line] of fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).entries()) {
    let record;
    try { record = JSON.parse(line); } catch (error) { errors.push(`${input}:${index + 1}: ${error.message}`); continue; }
    const block = record.randomization_block;
    if (!block) { errors.push(`${input}:${index + 1}: missing randomization_block`); continue; }
    const key = `${record.application_id}/${record.task_id}/${record.condition}/${block}`;
    const entry = groups.get(key) ?? { arms: new Map(), files: new Set() };
    if (entry.arms.has(record.arm)) errors.push(`${key}: duplicate arm ${record.arm}`);
    entry.arms.set(record.arm, record.run_id);
    entry.files.add(input);
    groups.set(key, entry);
  }
}
for (const [key, entry] of groups) {
  for (const arm of ['visual', 'hybrid', 'playwright']) if (!entry.arms.has(arm)) errors.push(`${key}: missing arm ${arm}`);
}
const summary = {
  status: errors.length ? 'incomplete' : 'ok',
  records: [...groups.values()].reduce((sum, entry) => sum + entry.arms.size, 0),
  randomization_blocks: groups.size,
  complete_blocks: [...groups.values()].filter((entry) => entry.arms.size === 3).length,
  errors
};
console.log(JSON.stringify(summary, null, 2));
if (errors.length) process.exitCode = 1;
