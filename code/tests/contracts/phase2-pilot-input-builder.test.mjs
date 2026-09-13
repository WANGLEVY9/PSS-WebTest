import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readDeduplicatedJsonl } from '../../src/ledger-files.mjs';

test('pilot input builder is strata-aware and fail-closed', () => {
  const source = fs.readFileSync(new URL('../../scripts/phase2-pilot-input-builder.mjs', import.meta.url), 'utf8');
  assert.match(source, /pilot-input-planning-only/);
  assert.match(source, /confirmatory_authorized: false/);
  assert.match(source, /conditionFamily/);
  assert.match(source, /legacyQuarantined/);
  assert.match(source, /reset_complete/);
  assert.match(source, /repetition_eligible/);
  assert.match(source, /provider_id/);
  assert.match(source, /model_id/);
  assert.match(source, /reset-complete-only/);
  assert.match(source, /resetCompleteOnly/);
  assert.match(source, /executionVariant/);
  assert.match(source, /execution_variant/);
});

test('ledger reader includes nested run-record ledgers and excludes duplicate run ids', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pss-ledger-'));
  try {
    fs.mkdirSync(path.join(root, 'run-records'));
    const record = JSON.stringify({ run_id: 'r1', schema_version: '0.1' });
    fs.writeFileSync(path.join(root, 'a.jsonl'), `${record}\n`);
    fs.writeFileSync(path.join(root, 'run-records', 'b.jsonl'), `${record}\n`);
    const result = readDeduplicatedJsonl([root], { repoRoot: root });
    assert.equal(result.entries.length, 1);
    assert.equal(result.duplicates.length, 1);
    assert.equal(result.files.length, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
