import fs from 'node:fs';
import path from 'node:path';
import { createRunRecord } from './run-records.mjs';

/**
 * Create the same immutable ledger record used by the agent arms for a
 * scripted Playwright cell.  `actions` is the number of explicit scripted
 * interactions in the test sequence, not an inferred DOM event count.
 */
export function createTraditionalRunRecord({
  application_id,
  application_version,
  task_id,
  execution_exit_code,
  oracle,
  wall_time_ms,
  actions,
  run_id = `${application_id}-playwright-${Date.now()}`,
  condition = 'clean-stable',
  runner_version = 'playwright-traditional-cell-v0.1',
  trace = []
}) {
  const passed = execution_exit_code === 0 && oracle?.passed === true;
  return createRunRecord({
    run_id,
    application_id,
    application_version,
    task_id,
    condition,
    arm: 'playwright',
    status: passed ? 'completed' : (execution_exit_code === 0 ? 'evaluator-error' : 'test-failure'),
    checkpoint_reached: passed,
    emitted_verdict: passed ? 'clean' : 'not-emitted',
    ground_truth_verdict: 'clean',
    timing: { wall_time_ms: Math.max(0, Math.round(wall_time_ms)), actions: Math.max(0, Math.trunc(actions)), retries: 0 },
    provenance: { runner_version, observation_contract: 'scripted-locator', model_id: null },
    failure_category: passed ? null : (execution_exit_code === 0 ? 'oracle' : 'execution'),
    trace
  });
}

export function appendRunRecord(record, outputPath) {
  if (!outputPath) return;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.appendFileSync(outputPath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
}
