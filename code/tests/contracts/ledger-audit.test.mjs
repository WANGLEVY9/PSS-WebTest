import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('ledger audit detects missing arms without accepting partial cells', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'pss-ledger-audit-'));
  const file = path.join(directory, 'one-arm.jsonl');
  writeFileSync(file, `${JSON.stringify({
    schema_version: '0.1', run_id: 'audit-visual-1', application_id: 'bookstack', application_version: '24.10.1', task_id: 'bookstack-create-page', condition: 'clean-stable', arm: 'visual', status: 'test-failure', checkpoint_reached: false, emitted_verdict: 'not-emitted', ground_truth_verdict: 'clean', timing: { wall_time_ms: 1, actions: 1, retries: 0, tokens: null, cost_usd: null }, provenance: { runner_version: 'test', trace_hash: 'a'.repeat(64), observation_contract: 'screenshot-only', model_id: 'test', seed: null }, failure_category: 'execution'
  })}\n`);
  let output = '';
  try { output = execFileSync(process.execPath, ['scripts/audit-run-ledger.mjs', file], { encoding: 'utf8' }); }
  catch (error) { output = error.stdout; }
  const summary = JSON.parse(output);
  assert.equal(summary.status, 'fail');
  assert.ok(summary.errors.some((error) => error.includes('missing arm playwright')));
  rmSync(directory, { recursive: true, force: true });
});
