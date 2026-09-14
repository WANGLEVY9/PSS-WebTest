#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const snapshotRoot = path.join(codeRoot, 'artifacts', 'benchmark-snapshots');
const inputPath = path.join(snapshotRoot, 'outcome-blind-task-candidates-v1.0.json');
const outputPath = path.join(snapshotRoot, 'screening-ledger-template-v1.0.json');
const CRITERIA = ['IC1', 'IC2', 'IC3', 'IC4', 'IC5', 'IC6', 'IC7'];
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');

export function buildScreeningLedgerTemplate(inventory = JSON.parse(fs.readFileSync(inputPath, 'utf8'))) {
  if (inventory?.status !== 'source-inventory-only-screening-pending' || inventory.confirmatory_authorized !== false) throw new Error('screening template requires an outcome-blind, non-confirmatory candidate inventory');
  const candidates = inventory.candidates ?? [];
  const candidateInventoryDigest = digest(JSON.stringify(candidates));
  const screeningRows = candidates.flatMap((candidate) => CRITERIA.map((criterion_code) => ({
    benchmark: candidate.benchmark_id,
    benchmark_version: candidate.source_commit,
    task_id: candidate.task_source_id,
    task_instruction_digest: candidate.instruction_digest,
    criterion_code,
    reviewer_1_decision: null,
    reviewer_2_decision: null,
    agreement: null,
    adjudicated_decision: null,
    evidence_reference: `${candidate.source_file}#${candidate.instruction_digest}`,
    timestamp: null
  })));
  const annotations = candidates.map((candidate) => ({
    benchmark: candidate.benchmark_id,
    benchmark_version: candidate.source_commit,
    task_id: candidate.task_source_id,
    task_instruction_digest: candidate.instruction_digest,
    annotation_source: 'outcome-blind-source-metadata',
    interaction_horizon: null,
    visual_dependency: null,
    structural_dependency: null,
    workflow_composition: null,
    cross_site: null,
    annotator_1: null,
    annotator_2: null,
    adjudicated_label: null,
    agreement_batch: null,
    notes: null
  }));
  return {
    schema_version: '1.0',
    generated_on: new Date().toISOString(),
    status: 'screening-template-not-started',
    confirmatory_authorized: false,
    source_candidate_inventory_digest: candidateInventoryDigest,
    candidate_count: candidates.length,
    criterion_count: CRITERIA.length,
    screening_row_count: screeningRows.length,
    screening_rows: screeningRows,
    task_annotations: annotations,
    limitations: [
      'All reviewer, adjudication, annotation, and decision fields are intentionally null.',
      'This template cannot authorize collection or establish an eligible-task denominator.',
      'Reviewers must independently screen before any arm execution and must never use arm outcomes to decide inclusion.'
    ]
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const template = buildScreeningLedgerTemplate();
  fs.writeFileSync(outputPath, `${JSON.stringify(template, null, 2)}\n`);
  console.log(JSON.stringify({ status: template.status, output: outputPath, candidate_count: template.candidate_count, screening_row_count: template.screening_row_count }, null, 2));
}
