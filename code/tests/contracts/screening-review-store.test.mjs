import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createScreeningReviewStore, candidateKey } from '../../src/screening-review-store.mjs';

const candidate = { benchmark_id: 'b', source_commit: 'c'.repeat(40), task_source_id: 'task-1', instruction_digest: 'a'.repeat(64), sites: ['site'], source_file: 'official.json' };

test('review store isolates reviewer decisions and preserves progress', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pss-review-'));
  const store = createScreeningReviewStore({ sample: { candidates: [candidate] }, root });
  const key = candidateKey(candidate);
  store.writeReviewerDecision({ reviewer: 'reviewer-1', key, criterion: 'IC1', decision: 'yes', evidence_reference: 'official.json:1' });
  assert.equal(store.snapshotForReviewer('reviewer-1').decisions[`${key}::IC1`].decision, 'yes');
  assert.equal(Object.keys(store.snapshotForReviewer('reviewer-2').decisions).length, 0);
  assert.equal(store.progress()['reviewer-1'].completed, 1);
  assert.equal(store.progress()['reviewer-2'].completed, 0);
});

test('conflicts require both independent decisions and adjudication is separate', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pss-review-'));
  const store = createScreeningReviewStore({ sample: { candidates: [candidate] }, root });
  const key = candidateKey(candidate);
  store.writeReviewerDecision({ reviewer: 'reviewer-1', key, criterion: 'IC4', decision: 'yes' });
  assert.throws(() => store.adjudicate({ key, criterion: 'IC4', decision: 'yes' }), /both independent/);
  store.writeReviewerDecision({ reviewer: 'reviewer-2', key, criterion: 'IC4', decision: 'no' });
  assert.equal(store.conflicts().length, 1);
  const saved = store.adjudicate({ key, criterion: 'IC4', decision: 'unclear', notes: 'needs source confirmation' });
  assert.equal(saved.decision, 'unclear');
});

test('review store rejects invalid reviewer, candidate, and decision', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pss-review-'));
  const store = createScreeningReviewStore({ sample: { candidates: [candidate] }, root });
  const key = candidateKey(candidate);
  assert.throws(() => store.writeReviewerDecision({ reviewer: 'reviewer-3', key, criterion: 'IC1', decision: 'yes' }), /reviewer/);
  assert.throws(() => store.writeReviewerDecision({ reviewer: 'reviewer-1', key: 'missing', criterion: 'IC1', decision: 'yes' }), /candidate/);
  assert.throws(() => store.writeReviewerDecision({ reviewer: 'reviewer-1', key, criterion: 'IC1', decision: 'maybe' }), /decision/);
});
