import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const SCREENING_CRITERIA = Object.freeze([
  ['IC1', 'Official task in the pinned public release'],
  ['IC2', 'Instruction and evaluator available without semantic edits'],
  ['IC3', 'Executable entirely through the benchmark browser environment'],
  ['IC4', 'Same semantic goal can be attempted by all three paradigms'],
  ['IC5', 'Reproducible reset or benchmark reinitialization'],
  ['IC6', 'Deterministic evaluator or pre-registered tolerance'],
  ['IC7', 'No secret, external, or privileged information required']
]);
const CRITERION_CODES = new Set(SCREENING_CRITERIA.map(([code]) => code));
const REVIEWERS = new Set(['reviewer-1', 'reviewer-2']);
const DECISIONS = new Set(['yes', 'no', 'unclear']);

export function candidateKey(candidate) {
  return [candidate.benchmark_id, candidate.source_commit, candidate.task_source_id, candidate.instruction_digest].join('|');
}

function safeReviewer(value) {
  if (!REVIEWERS.has(value)) throw new Error('reviewer must be reviewer-1 or reviewer-2');
  return value;
}

function safeDecision(value) {
  if (!DECISIONS.has(value)) throw new Error('decision must be yes, no, or unclear');
  return value;
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

function readObject(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

export function createScreeningReviewStore({ sample, root }) {
  const candidates = sample?.candidates ?? [];
  const candidateMap = new Map(candidates.map((candidate) => [candidateKey(candidate), candidate]));
  const stateRoot = path.resolve(root);
  const reviewerPath = (reviewer) => path.join(stateRoot, `${safeReviewer(reviewer)}.json`);
  const eventsPath = (reviewer) => path.join(stateRoot, `${safeReviewer(reviewer)}.events.jsonl`);
  const adjudicationPath = path.join(stateRoot, 'adjudication.json');

  function readReviewer(reviewer) {
    safeReviewer(reviewer);
    const value = readObject(reviewerPath(reviewer), null);
    if (!value || value.schema_version !== '1.0' || value.reviewer !== reviewer || typeof value.decisions !== 'object') {
      return { schema_version: '1.0', reviewer, updated_at: null, decisions: {} };
    }
    return value;
  }

  function writeReviewerDecision({ reviewer, key, criterion, decision, evidence_reference = '', notes = '' }) {
    safeReviewer(reviewer); safeDecision(decision);
    if (!candidateMap.has(key)) throw new Error('candidate is not in the frozen screening pilot sample');
    if (!CRITERION_CODES.has(criterion)) throw new Error('criterion must be IC1 through IC7');
    const evidence = String(evidence_reference ?? '').slice(0, 1000);
    const note = String(notes ?? '').slice(0, 2000);
    const previous = readReviewer(reviewer);
    const now = new Date().toISOString();
    const next = { ...previous, updated_at: now, decisions: { ...previous.decisions, [`${key}::${criterion}`]: { decision, evidence_reference: evidence, notes: note, timestamp: now } } };
    atomicWrite(reviewerPath(reviewer), next);
    fs.mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
    fs.appendFileSync(eventsPath(reviewer), `${JSON.stringify({ reviewer, key, criterion, decision, evidence_reference: evidence, notes: note, timestamp: now })}\n`, { mode: 0o600 });
    return next.decisions[`${key}::${criterion}`];
  }

  function progress() {
    const total = candidates.length * SCREENING_CRITERIA.length;
    return Object.fromEntries([...REVIEWERS].map((reviewer) => {
      const decisions = readReviewer(reviewer).decisions;
      const count = Object.values(decisions).filter((entry) => DECISIONS.has(entry?.decision)).length;
      return [reviewer, { completed: count, total, fraction: total ? count / total : 0 }];
    }));
  }

  function conflicts() {
    const first = readReviewer('reviewer-1').decisions;
    const second = readReviewer('reviewer-2').decisions;
    const rows = [];
    for (const candidate of candidates) for (const [criterion] of SCREENING_CRITERIA) {
      const key = `${candidateKey(candidate)}::${criterion}`;
      const a = first[key]?.decision ?? null; const b = second[key]?.decision ?? null;
      if (a && b && a !== b) rows.push({ key: candidateKey(candidate), candidate, criterion, reviewer_1: a, reviewer_2: b });
    }
    return rows;
  }

  function adjudicate({ key, criterion, decision, notes = '' }) {
    safeDecision(decision);
    if (!candidateMap.has(key) || !CRITERION_CODES.has(criterion)) throw new Error('invalid candidate or criterion');
    const first = readReviewer('reviewer-1').decisions[`${key}::${criterion}`]?.decision;
    const second = readReviewer('reviewer-2').decisions[`${key}::${criterion}`]?.decision;
    if (!first || !second) throw new Error('both independent reviewer decisions are required before adjudication');
    const current = readObject(adjudicationPath, { schema_version: '1.0', updated_at: null, decisions: {} });
    const timestamp = new Date().toISOString();
    const next = { ...current, updated_at: timestamp, decisions: { ...current.decisions, [`${key}::${criterion}`]: { decision, notes: String(notes ?? '').slice(0, 2000), reviewer_1: first, reviewer_2: second, timestamp } } };
    atomicWrite(adjudicationPath, next);
    return next.decisions[`${key}::${criterion}`];
  }

  function snapshotForReviewer(reviewer) {
    safeReviewer(reviewer);
    const decisions = readReviewer(reviewer).decisions;
    return { schema_version: '1.0', status: 'outcome-blind-review-workspace', confirmatory_authorized: false, reviewer, criteria: SCREENING_CRITERIA.map(([code, label]) => ({ code, label })), candidates, decisions, progress: progress()[reviewer] };
  }

  return { snapshotForReviewer, writeReviewerDecision, progress, conflicts, adjudicate, candidateCount: candidates.length };
}

export function sampleDigest(sample) {
  return crypto.createHash('sha256').update(JSON.stringify(sample?.candidates ?? []), 'utf8').digest('hex');
}
