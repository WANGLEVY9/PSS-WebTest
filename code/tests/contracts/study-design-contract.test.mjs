import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateStudyDesignContract } from '../../scripts/validate-study-design-contract.mjs';

const codeRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const contract = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config', 'study-design-contract.v1.0.json'), 'utf8'));
const metrics = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config', 'metric-dictionary.v1.0.json'), 'utf8'));

test('final-design candidate is valid, paused, and fail-closed', () => {
  assert.deepEqual(validateStudyDesignContract(contract), []);
  assert.equal(contract.execution_status, 'paused');
  assert.equal(contract.confirmatory_authorized, false);
  assert.equal(contract.implementation_readiness.ready_for_new_evaluated_runs, false);
});

test('benchmark population is externally defined and excludes legacy pilots from confirmation', () => {
  assert.deepEqual(contract.benchmark_portfolio.mandatory_core.map((item) => item.id), [
    'webarena-verified',
    'visualwebarena',
    'autonomous-tester-agent-benchmark'
  ]);
  assert.equal(contract.benchmark_portfolio.legacy_local_pilots.confirmatory_use, 'prohibited');
  assert.equal(contract.task_filtering.outcome_blind, true);
});

test('pure visual and Hybrid boundaries prohibit privileged information', () => {
  assert.ok(contract.information_boundaries.pure_visual_cua.disallowed.includes('raw DOM'));
  assert.ok(contract.information_boundaries.pure_visual_cua.disallowed.includes('accessibility tree'));
  assert.ok(contract.information_boundaries.hybrid_agent.disallowed.includes('raw HTML'));
  assert.ok(contract.information_boundaries.hybrid_agent.disallowed.includes('CSS selectors'));
  assert.equal(contract.information_boundaries.enforcement.boundary_violation_invalidates_run, true);
});

test('Traditional authoring is outcome-blind and adaptation failures stay in the denominator', () => {
  assert.equal(contract.traditional_adaptation.review.author_blind_to_agent_results, true);
  assert.equal(contract.traditional_adaptation.review.reviewer_blind_to_agent_results, true);
  assert.match(contract.traditional_adaptation.adaptation_failure_policy, /do not exclude/);
  assert.ok(contract.traditional_adaptation.required_cost_fields.includes('authoring_minutes'));
  assert.ok(contract.traditional_adaptation.required_cost_fields.includes('debug_edit_count'));
});

test('legacy runners and records cannot enter the redesigned confirmatory denominator', () => {
  assert.equal(contract.implementation_readiness.legacy_runner_use, 'diagnostic-only');
  assert.equal(contract.implementation_readiness.legacy_record_use, 'engineering-and-feasibility-only');
  assert.ok(contract.implementation_readiness.blocking_gaps.some((gap) => gap.includes('progress tokens')));
  assert.ok(contract.implementation_readiness.blocking_gaps.some((gap) => gap.includes('run-record schema')));
});

test('metric dictionary keeps benchmark success, testing correctness, reliability, and cost separate', () => {
  const ids = new Set(metrics.metrics.map((metric) => metric.id));
  for (const id of ['official_task_success', 'testing_verdict_correct', 'false_pass_rate', 'task_level_reliability', 'wall_time_ms', 'authoring_minutes', 'exclusive_success', 'oracle_gain']) {
    assert.ok(ids.has(id), `missing metric ${id}`);
  }
  assert.equal(metrics.single_composite_score, 'prohibited');
  assert.equal(metrics.estimands.find((item) => item.id === 'deployment-effectiveness').provider_or_framework_failure, 'failure');
  assert.match(metrics.estimands.find((item) => item.id === 'capability-sensitivity').exclusion_rule, /never logical/);
});

test('screening and Traditional adaptation ledgers expose the required audit columns', () => {
  const researchRoot = path.resolve(codeRoot, '..', 'research', 'protocol');
  const headers = (name) => new Set(fs.readFileSync(path.join(researchRoot, name), 'utf8').trim().split(','));
  for (const field of ['benchmark', 'benchmark_version', 'task_id', 'inclusion_decision', 'task_instruction_digest', 'evaluator_digest']) {
    assert.ok(headers('included_tasks.csv').has(field), `included_tasks.csv missing ${field}`);
  }
  for (const field of ['benchmark', 'benchmark_version', 'task_id', 'exclusion_code', 'evidence_reference']) {
    assert.ok(headers('excluded_tasks.csv').has(field), `excluded_tasks.csv missing ${field}`);
  }
  for (const field of ['task_id', 'script_hash', 'authoring_minutes', 'debugging_minutes', 'review_minutes', 'semantic_review_status', 'black_box_conformance_status']) {
    assert.ok(headers('traditional_adaptation_ledger.csv').has(field), `traditional_adaptation_ledger.csv missing ${field}`);
  }
});
