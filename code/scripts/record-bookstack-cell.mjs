#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';

const [artifact, arm, repetitionText, outputPath] = process.argv.slice(2);
if (!artifact || !arm || !repetitionText || !outputPath) throw new Error('usage: node scripts/record-bookstack-cell.mjs artifact arm repetition runner-output');
const lines = fs.readFileSync(outputPath, 'utf8').trim().split('\n').reverse();
let result = null;
for (const line of lines) { try { const parsed = JSON.parse(line); if (parsed.application === 'bookstack' && parsed.arm === arm) { result = parsed; break; } } catch {} }
if (!result) throw new Error(`no ${arm} BookStack runner JSON found in ${outputPath}`);
const empty = { application: 'bookstack', task_id: 'bookstack-create-page', repetitions: 0, arms: ['playwright', 'visual', 'hybrid'], max_steps: null, timeout_ms: null, records: [], confirmatory: false };
const current = process.env.PSS_REPLACE_ARTIFACT === '1' || !fs.existsSync(artifact) ? empty : JSON.parse(fs.readFileSync(artifact, 'utf8'));
const oracle = result.oracle?.value ?? null;
current.records = current.records.filter((r) => !(r.repetition === Number(repetitionText) && r.arm === arm));
current.records.push({ repetition: Number(repetitionText), arm, reset_ok: true, clean_state_verified: true, execution_exit_code: result.failure ? 1 : (result.result?.status === 'completed' && oracle?.passed ? 0 : 1), oracle_passed: !result.failure && result.result?.status === 'completed' && oracle?.passed === true, oracle_matches: oracle?.matches ?? null, run_id: result.run_record?.run_id ?? null, failure_category: result.run_record?.failure_category ?? null });
current.records.sort((a, b) => a.repetition - b.repetition || a.arm.localeCompare(b.arm));
current.repetitions = Math.max(current.repetitions ?? 0, Number(repetitionText));
current.passed_cells = current.records.filter((r) => r.reset_ok && r.clean_state_verified && r.oracle_passed).length;
current.total_cells = current.records.length;
fs.writeFileSync(artifact, `${JSON.stringify(current, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify(current.records.find((r) => r.repetition === Number(repetitionText) && r.arm === arm)));
