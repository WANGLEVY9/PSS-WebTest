import fs from 'node:fs';
import path from 'node:path';
import { summarizePairedCleanFault, renderPairedCleanFaultReport } from '../src/paired-clean-fault-metrics.mjs';

const args = process.argv.slice(2);
const valueFor = (flag) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; };
const cleanPath = valueFor('--clean');
const faultPath = valueFor('--fault');
const jsonOutput = valueFor('--json-output');
const markdownOutput = valueFor('--markdown-output');
if (!cleanPath || !faultPath || !jsonOutput || !markdownOutput) throw new Error('usage: node scripts/paired-clean-fault-metrics.mjs --clean clean.jsonl --fault fault.jsonl --json-output summary.json --markdown-output report.md');
const readJsonl = (input) => fs.readFileSync(input, 'utf8').split(/\r?\n/).filter(Boolean).map(JSON.parse);
const summary = summarizePairedCleanFault([...readJsonl(cleanPath), ...readJsonl(faultPath)]);
const payload = { schema_version: '0.1', inputs: { clean: cleanPath, fault: faultPath }, rows: summary, generated_at: new Date().toISOString(), confirmatory: false };
fs.mkdirSync(path.dirname(jsonOutput), { recursive: true });
fs.mkdirSync(path.dirname(markdownOutput), { recursive: true });
fs.writeFileSync(jsonOutput, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
fs.writeFileSync(markdownOutput, renderPairedCleanFaultReport(summary, { generatedAt: payload.generated_at }), { mode: 0o600 });
console.log(JSON.stringify({ status: 'ok', arms: summary.length, json_output: jsonOutput, markdown_output: markdownOutput }));
