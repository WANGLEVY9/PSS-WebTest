#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createRunRecord } from '../src/run-records.mjs';

const args = process.argv.slice(2);
const get = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const inputPath = get('--input');
const outputPath = get('--output');
if (!inputPath || !outputPath) { console.error('usage: node scripts/collect-run-records.mjs --input raw.jsonl --output records.jsonl'); process.exit(2); }
const lines = fs.readFileSync(inputPath, 'utf8').split(/\r?\n/).filter(Boolean);
const records = lines.map((line, index) => {
  try { return createRunRecord(JSON.parse(line)); } catch (error) { throw new Error(`invalid run ${index + 1}: ${error.message}`); }
});
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : ''), { mode: 0o600 });
console.log(JSON.stringify({ status: 'ok', records: records.length, output: outputPath }));

