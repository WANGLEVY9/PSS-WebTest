import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('./merge-wav-qwen-pair.mjs', import.meta.url));
test('resumed slices retain invalid attempts and select only one valid chain per cell', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pss-wav-merge-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const job = {task_id: 260, framework: 'agentlab-browsergym', mode: 'visual', model: 'qwen3.8-flash'};
  for (const [batch, valid] of [['initial', false], ['resumed', true]]) {
    const dir = path.join(root, batch);
    const stem = '00-qwen3.8-flash-260-agentlab-browsergym-visual';
    fs.mkdirSync(path.join(dir, stem, 'trajectory'), {recursive: true});
    fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({schema: 'pss-qwen38-paired-acceptance-v1',
      scope: 'diagnostic', confirmatory_authorized: false, source_sha256: batch, jobs: [job]}));
    fs.writeFileSync(path.join(dir, stem, 'report.json'), JSON.stringify({...job,
      model: {model: job.model}, confirmatory_authorized: false,
      official_task_started: valid, official_task_completed: valid, official_score: valid ? 0 : null,
      assessment_status: valid ? 'valid' : null, owned_cleanup_completed: true,
      replay: {passed: valid}, actor_status: valid ? 'invalid-action' : null}));
    fs.writeFileSync(path.join(dir, stem, 'trajectory', 'actor-receipt.json'),
      JSON.stringify({source_tree_unchanged: valid, terminal_status: valid ? 'invalid-action' : null}));
  }
  const out = path.join(root, 'merged.json');
  const run = spawnSync(process.execPath, [script, out, path.join(root, 'initial'), path.join(root, 'resumed')], {encoding: 'utf8'});
  assert.equal(run.status, 0, run.stderr);
  const merged = JSON.parse(fs.readFileSync(out));
  assert.equal(merged.attempted_processes, 2);
  assert.equal(merged.valid_cells, 1);
  assert.equal(merged.cells[0].official_score, 0);
  assert.equal(merged.cells[0].selected_batch, 'resumed');
  assert.equal(merged.pooled_comparative_claim_authorized, false);
});
