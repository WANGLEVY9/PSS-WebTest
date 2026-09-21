#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const read = (name) => JSON.parse(fs.readFileSync(path.join(codeRoot, 'config', name), 'utf8'));
const contract = read('study-design-contract.v1.0.json');
const plan = read('long-cycle-experiment-plan.v1.0.json');
const metrics = read('metric-dictionary.v0.1.json');
const expectedCore = ['webarena-verified', 'visualwebarena', 'autonomous-tester-agent-benchmark'];

export function auditStudyDesignCompliance({ design = contract, cycle = plan, metricDictionary = metrics } = {}) {
  const errors = [];
  const checks = {};
  const core = design.benchmark_portfolio?.mandatory_core?.map((item) => item.id) ?? [];
  checks.core_benchmarks = JSON.stringify(core) === JSON.stringify(expectedCore);
  if (!checks.core_benchmarks) errors.push('mandatory core benchmark set drifted');
  checks.execution_paused = design.execution_status === 'paused' && design.confirmatory_authorized === false;
  if (!checks.execution_paused) errors.push('confirmatory execution is not explicitly paused');
  checks.outcome_blind_freeze = design.task_filtering?.outcome_blind === true && design.task_filtering?.eligible_task_set_freeze?.required_before_any_arm_execution === true && design.task_filtering?.eligible_task_set_freeze?.manifest_digest_required === true;
  if (!checks.outcome_blind_freeze) errors.push('outcome-blind task-set freeze is incomplete');
  checks.local_pilots_quarantined = design.benchmark_portfolio?.legacy_local_pilots?.confirmatory_use === 'prohibited' && design.implementation_readiness?.legacy_runner_use === 'diagnostic-only';
  if (!checks.local_pilots_quarantined) errors.push('legacy local pilots are not quarantined');
  checks.boundaries_enforced = design.information_boundaries?.enforcement?.boundary_violation_invalidates_run === true && design.information_boundaries?.pure_visual_cua?.disallowed?.length > 0 && design.information_boundaries?.hybrid_agent?.disallowed?.length > 0;
  if (!checks.boundaries_enforced) errors.push('pure-visual/Hybrid information boundaries are incomplete');
  checks.traditional_fairness = design.traditional_adaptation?.review?.author_blind_to_agent_results === true && design.traditional_adaptation?.review?.reviewer_blind_to_agent_results === true && /do not exclude/.test(design.traditional_adaptation?.adaptation_failure_policy ?? '');
  if (!checks.traditional_fairness) errors.push('Traditional adaptation blindness or denominator rule drifted');
  checks.metrics_separate = /never collapse|separately/.test(metricDictionary.principle ?? '') && metricDictionary.metrics?.some((metric) => metric.id === 'valid_completion') && metricDictionary.metrics?.some((metric) => metric.id === 'verdict_correct');
  if (!checks.metrics_separate) errors.push('primary effectiveness/oracle metrics are not separately defined');
  checks.scale_target = Number(cycle.scale?.minimum_layer_a_scheduled_units) >= 3000 && cycle.scale?.scale_is_not_power_substitute === true;
  if (!checks.scale_target) errors.push('long-cycle scale target or power distinction is missing');
  checks.no_authorization_in_plan = cycle.confirmatory_authorized === false && cycle.current_state !== 'CONFIRMATORY_AUTHORIZED';
  if (!checks.no_authorization_in_plan) errors.push('long-cycle plan claims confirmatory authorization');
  return { status: errors.length ? 'design-compliance-failed' : 'design-compliance-passed-execution-paused', confirmatory_authorized: false, checks, errors };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  if(!process.argv.includes('--legacy-audit')) {
    const {studyStatus}=await import('../local-lab/study-design.mjs');
    console.log(JSON.stringify({status:'active-manuscript-design-valid-runtime-evidence-separate',...studyStatus()},null,2));
    process.exit(0);
  }
  const result = auditStudyDesignCompliance();
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
