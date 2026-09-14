#!/usr/bin/env node
/**
 * Fail-closed audit for the outcome-blind benchmark screening ledger.
 *
 * This gate is deliberately independent of any runner.  It verifies that the
 * screening artifact still refers to the frozen source inventory and that
 * every candidate has two independent reviews, an adjudication, and two
 * independent task-characteristic annotations before an eligible-task
 * manifest can be produced.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const snapshotRoot = path.join(codeRoot, 'artifacts', 'benchmark-snapshots');
const inventoryPath = path.join(snapshotRoot, 'outcome-blind-task-candidates-v1.0.json');
const templatePath = path.join(snapshotRoot, 'screening-ledger-template-v1.0.json');
const CRITERIA = ['IC1', 'IC2', 'IC3', 'IC4', 'IC5', 'IC6', 'IC7'];
const REVIEW_DECISIONS = new Set(['yes', 'no', 'unclear']);
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const candidateKey = (row) => `${row.benchmark ?? row.benchmark_id}|${row.benchmark_version ?? row.source_commit}|${row.task_id ?? row.task_source_id}|${row.task_instruction_digest ?? row.instruction_digest ?? ''}`;

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

export function auditScreeningLedger(inventory, ledger) {
  const errors = [];
  const candidates = inventory?.candidates ?? [];
  const expectedDigest = digest(JSON.stringify(candidates));
  if (inventory?.status !== 'source-inventory-only-screening-pending') errors.push('inventory is not outcome-blind and screening-pending');
  if (inventory?.confirmatory_authorized !== false) errors.push('inventory must not authorize confirmatory collection');
  if (ledger?.schema_version !== '1.0') errors.push('screening ledger schema_version must be 1.0');
  if (ledger?.source_candidate_inventory_digest !== expectedDigest) errors.push('screening ledger source digest does not match the frozen candidate inventory');
  if (ledger?.candidate_count !== candidates.length) errors.push('screening ledger candidate_count does not match inventory');
  if (ledger?.criterion_count !== CRITERIA.length) errors.push('screening ledger criterion_count must be 7');

  const candidateKeys = candidates.map(candidateKey);
  const candidateSet = new Set(candidateKeys);
  if (candidateSet.size !== candidateKeys.length) errors.push('source inventory contains duplicate candidate identities; task instruction digest must disambiguate repeated task ids');
  const rows = Array.isArray(ledger?.screening_rows) ? ledger.screening_rows : [];
  const byCandidate = new Map();
  for (const row of rows) {
    const key = candidateKey(row);
    if (!candidateSet.has(key)) errors.push(`screening row references an unknown candidate: ${key}`);
    const bucket = byCandidate.get(key) ?? new Map();
    if (bucket.has(row.criterion_code)) errors.push(`duplicate screening row: ${key}/${row.criterion_code}`);
    bucket.set(row.criterion_code, row);
    byCandidate.set(key, bucket);
    if (!CRITERIA.includes(row.criterion_code)) errors.push(`unsupported criterion code: ${row.criterion_code}`);
    if (!/^[a-f0-9]{64}$/.test(row.task_instruction_digest ?? '')) errors.push(`screening row requires the source instruction digest: ${key}`);
    for (const field of ['reviewer_1_decision', 'reviewer_2_decision', 'adjudicated_decision']) {
      const value = row[field];
      if (value !== null && !REVIEW_DECISIONS.has(value)) errors.push(`${field} must be yes, no, or unclear`);
    }
    if (row.reviewer_1_decision !== null && row.reviewer_2_decision !== null && row.reviewer_1_decision === row.reviewer_2_decision && row.agreement !== true) errors.push(`agreement flag is missing for matching reviews: ${key}/${row.criterion_code}`);
    if (row.adjudicated_decision !== null && typeof row.timestamp !== 'string') errors.push(`adjudicated screening row requires timestamp: ${key}/${row.criterion_code}`);
  }
  for (const candidate of candidates) {
    const key = candidateKey(candidate);
    const bucket = byCandidate.get(key) ?? new Map();
    for (const criterion of CRITERIA) if (!bucket.has(criterion)) errors.push(`missing screening row: ${key}/${criterion}`);
  }

  const annotations = Array.isArray(ledger?.task_annotations) ? ledger.task_annotations : [];
  const annotationsByCandidate = new Map();
  for (const row of annotations) {
    const key = candidateKey(row);
    if (annotationsByCandidate.has(key)) errors.push(`duplicate task annotation: ${key}`);
    annotationsByCandidate.set(key, row);
    if (!candidateSet.has(key)) errors.push(`task annotation references an unknown candidate: ${key}`);
    if (!/^[a-f0-9]{64}$/.test(row.task_instruction_digest ?? '')) errors.push(`task annotation requires the source instruction digest: ${key}`);
    for (const field of ['interaction_horizon', 'visual_dependency', 'structural_dependency', 'workflow_composition', 'cross_site']) {
      if (row[field] !== null && typeof row[field] !== 'string') errors.push(`annotation ${field} must remain null or a label: ${key}`);
    }
    const complete = ['annotator_1', 'annotator_2', 'adjudicated_label'].every((field) => typeof row[field] === 'string' && row[field].trim());
    if (complete && typeof row.agreement_batch !== 'string') errors.push(`completed annotation requires agreement_batch: ${key}`);
  }
  for (const candidate of candidates) if (!annotationsByCandidate.has(candidateKey(candidate))) errors.push(`missing task annotation: ${candidateKey(candidate)}`);

  const complete = errors.length === 0 && candidates.length > 0 && rows.length === candidates.length * CRITERIA.length && annotations.length === candidates.length && rows.every((row) => REVIEW_DECISIONS.has(row.reviewer_1_decision) && REVIEW_DECISIONS.has(row.reviewer_2_decision) && REVIEW_DECISIONS.has(row.adjudicated_decision)) && annotations.every((row) => ['annotator_1', 'annotator_2', 'adjudicated_label', 'agreement_batch'].every((field) => typeof row[field] === 'string' && row[field].trim()));
  return {
    status: complete ? 'screening-complete-pending-manifest-freeze' : 'screening-pending',
    confirmatory_authorized: false,
    candidate_count: candidates.length,
    screening_row_count: rows.length,
    annotation_count: annotations.length,
    errors
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = auditScreeningLedger(readJson(inventoryPath), readJson(templatePath));
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length || result.status !== 'screening-complete-pending-manifest-freeze') process.exitCode = 2;
}
