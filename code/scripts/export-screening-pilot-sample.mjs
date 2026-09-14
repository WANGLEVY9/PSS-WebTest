#!/usr/bin/env node
/**
 * Export a deterministic, outcome-blind screening pilot sample.
 *
 * The sample is stratified by benchmark and official site/application (when
 * present), uses the frozen study seed, and contains no arm/evaluator fields.
 * It is a reviewer work queue only; it cannot authorize confirmatory runs.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const snapshotRoot = path.join(codeRoot, 'artifacts', 'benchmark-snapshots');
const inputPath = path.join(snapshotRoot, 'outcome-blind-task-candidates-v1.0.json');
const outputPath = path.join(snapshotRoot, 'screening-pilot-sample-v1.0.json');
const packetPath = path.join(snapshotRoot, 'screening-pilot-review-packet-v1.0.csv');
const fraction = Number.parseFloat(process.env.PSS_SCREENING_PILOT_FRACTION ?? '0.10');
const seed = Number.parseInt(process.env.PSS_SCREENING_RANDOM_SEED ?? '20260914', 10);

function candidateKey(candidate) {
  return [candidate.benchmark_id, candidate.source_commit, candidate.task_source_id, candidate.instruction_digest].join('|');
}

function hashRank(key, salt) {
  const digest = crypto.createHash('sha256').update(`${salt}|${key}`, 'utf8').digest('hex');
  return Number.parseInt(digest.slice(0, 12), 16);
}

function strataKey(candidate) {
  const sites = Array.isArray(candidate.sites) && candidate.sites.length > 0 ? [...candidate.sites].sort().join(',') : '(site-unspecified)';
  return `${candidate.benchmark_id}|${sites}`;
}

function selectPilot(candidates, sampleFraction, randomSeed) {
  if (!Number.isFinite(sampleFraction) || sampleFraction <= 0 || sampleFraction > 1) throw new Error('PSS_SCREENING_PILOT_FRACTION must be in (0,1]');
  if (!Number.isInteger(randomSeed) || randomSeed < 0) throw new Error('PSS_SCREENING_RANDOM_SEED must be a non-negative integer');
  const groups = new Map();
  for (const candidate of candidates) {
    const key = strataKey(candidate);
    const bucket = groups.get(key) ?? [];
    bucket.push(candidate);
    groups.set(key, bucket);
  }
  const selected = [];
  const counts = {};
  for (const [stratum, bucket] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const count = Math.min(bucket.length, Math.max(1, Math.ceil(bucket.length * sampleFraction)));
    const ranked = [...bucket].sort((a, b) => {
      const rankA = hashRank(candidateKey(a), randomSeed);
      const rankB = hashRank(candidateKey(b), randomSeed);
      return rankA - rankB || candidateKey(a).localeCompare(candidateKey(b));
    });
    selected.push(...ranked.slice(0, count));
    counts[stratum] = { population: bucket.length, selected: count };
  }
  return { selected, counts };
}

export function buildScreeningPilotSample(inventory, { sampleFraction = fraction, randomSeed = seed } = {}) {
  if (inventory?.status !== 'source-inventory-only-screening-pending' || inventory.confirmatory_authorized !== false) throw new Error('pilot sample requires a non-confirmatory outcome-blind inventory');
  const candidates = inventory.candidates ?? [];
  const { selected, counts } = selectPilot(candidates, sampleFraction, randomSeed);
  const allowedKeys = new Set(['benchmark_id', 'source_commit', 'task_source_id', 'instruction_digest', 'sites', 'start_url_count', 'require_login', 'difficulty', 'source_file']);
  const sample = selected.map((candidate) => Object.fromEntries(Object.entries(candidate).filter(([key]) => allowedKeys.has(key))));
  return {
    schema_version: '1.0',
    generated_on: new Date().toISOString(),
    status: 'screening-pilot-sample-outcome-blind',
    confirmatory_authorized: false,
    source_inventory_digest: crypto.createHash('sha256').update(JSON.stringify(candidates), 'utf8').digest('hex'),
    random_seed: randomSeed,
    requested_fraction: sampleFraction,
    candidate_count: candidates.length,
    sample_count: sample.length,
    strata: counts,
    candidates: sample,
    reviewer_protocol: {
      reviewers: 2,
      independent_first_pass: true,
      adjudication_required: true,
      arm_outcomes_visible: false,
      note: 'This is a work queue only. Decisions must be entered into the screening ledger after independent review.'
    }
  };
}

export function buildScreeningReviewPacket(sample) {
  const criteria = ['IC1', 'IC2', 'IC3', 'IC4', 'IC5', 'IC6', 'IC7'];
  const header = ['benchmark', 'benchmark_version', 'task_id', 'task_instruction_digest', 'sites', 'source_file', 'criterion_code', 'reviewer_decision', 'evidence_reference', 'notes'];
  const rows = [header];
  for (const candidate of sample.candidates ?? []) {
    for (const criterion of criteria) {
      rows.push([
        candidate.benchmark_id,
        candidate.source_commit,
        candidate.task_source_id,
        candidate.instruction_digest,
        (candidate.sites ?? []).join('|'),
        candidate.source_file,
        criterion,
        '',
        `${candidate.source_file}#${candidate.instruction_digest}`,
        ''
      ]);
    }
  }
  return rows.map((row) => row.map((value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  }).join(',')).join('\n') + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const inventory = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const output = buildScreeningPilotSample(inventory);
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  fs.writeFileSync(packetPath, buildScreeningReviewPacket(output));
  console.log(JSON.stringify({ status: output.status, output: outputPath, review_packet: packetPath, candidate_count: output.candidate_count, sample_count: output.sample_count, review_rows: output.sample_count * 7, strata_count: Object.keys(output.strata).length, confirmatory_authorized: output.confirmatory_authorized }, null, 2));
}
