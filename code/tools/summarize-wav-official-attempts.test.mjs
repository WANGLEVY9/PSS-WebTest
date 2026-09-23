import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('./summarize-wav-official-attempts.mjs', import.meta.url));
test('complete provider failure is retained but not analysis eligible', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pss-wav-attempt-summary-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const attempt = path.join(root, 'attempt-a');
  fs.mkdirSync(path.join(attempt, 'trajectory'), {recursive: true});
  fs.writeFileSync(path.join(attempt, 'configuration.json'), JSON.stringify({script_sha256: 'abc'}));
  fs.writeFileSync(path.join(attempt, 'report.json'), JSON.stringify({
    kind: 'OFFICIAL_WAV_TASK_ACCEPTANCE_PROBE', confirmatory_authorized: false,
    task_id: 261, framework: 'agentlab-browsergym', mode: 'visual', model: {model: 'qwen3.8-flash'},
    official_task_started: true, official_task_completed: true, assessment_status: 'valid',
    owned_cleanup_completed: true, replay: {passed: true}, actor_status: 'provider-error', official_score: 0}));
  fs.writeFileSync(path.join(attempt, 'trajectory', 'actor-receipt.json'),
    JSON.stringify({source_tree_unchanged: true, terminal_status: 'provider-error'}));
  const out = path.join(root, 'summary.json');
  const run = spawnSync(process.execPath, [script, out, attempt], {encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
  const summary = JSON.parse(fs.readFileSync(out));
  assert.equal(summary.lifecycle_complete_attempts, 1);
  assert.equal(summary.analysis_eligible_attempts, 0);
  assert.equal(summary.attempts[0].traditional_script_sha256, null);
});

test('Traditional script execution failure is not silently removed from deployment accounting', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pss-wav-traditional-summary-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const attempt = path.join(root, 'attempt-b');
  fs.mkdirSync(path.join(attempt, 'trajectory'), {recursive: true});
  fs.writeFileSync(path.join(attempt, 'configuration.json'), JSON.stringify({script_sha256: 'pinned-script'}));
  fs.writeFileSync(path.join(attempt, 'report.json'), JSON.stringify({
    kind: 'OFFICIAL_WAV_TASK_ACCEPTANCE_PROBE', confirmatory_authorized: false,
    task_id: 261, framework: 'playwright', mode: 'traditional', model: null,
    official_task_started: true, official_task_completed: true, assessment_status: 'valid',
    owned_cleanup_completed: true, replay: {passed: true}, actor_status: 'execution-error',
    failure_class: 'TimeoutError', official_score: 0}));
  fs.writeFileSync(path.join(attempt, 'trajectory', 'actor-receipt.json'),
    JSON.stringify({source_tree_unchanged: true, terminal_status: 'execution-error'}));
  const out = path.join(root, 'summary.json');
  const run = spawnSync(process.execPath, [script, out, attempt], {encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
  const summary = JSON.parse(fs.readFileSync(out));
  assert.equal(summary.traditional_script_failures_retained, 1);
  assert.equal(summary.attempts[0].traditional_script_failure_retained, true);
  assert.equal(summary.attempts[0].analysis_eligible, false);
});
