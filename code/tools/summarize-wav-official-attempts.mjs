// Sanitize a task's separately preserved official diagnostic attempts.
// Never read raw prompts, screenshots, HAR, evaluator gold, or local credentials.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [output, ...directories] = process.argv.slice(2);
if (!output || directories.length === 0)
  throw Error('Usage: node tools/summarize-wav-official-attempts.mjs NEW_OUTPUT.json ATTEMPT_DIR...');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const rows = [];
let taskId;
for (const name of directories) {
  const root = path.resolve(name);
  const bytes = fs.readFileSync(path.join(root, 'report.json'));
  const report = JSON.parse(bytes);
  if (report.kind !== 'OFFICIAL_WAV_TASK_ACCEPTANCE_PROBE' || report.confirmatory_authorized !== false)
    throw Error('Only official diagnostic WAV probe reports are accepted');
  taskId ??= report.task_id;
  if (report.task_id !== taskId) throw Error('Mixed official task IDs');
  const configuration = JSON.parse(fs.readFileSync(path.join(root, 'configuration.json')));
  const receiptFile = path.join(root, 'trajectory', 'actor-receipt.json');
  const receipt = fs.existsSync(receiptFile) ? JSON.parse(fs.readFileSync(receiptFile)) : {};
  const lifecycleComplete = report.official_task_started === true && report.official_task_completed === true &&
    report.assessment_status === 'valid' && report.owned_cleanup_completed === true &&
    !report.engineering_error && !report.cleanup_error && report.replay?.passed === true &&
    receipt.source_tree_unchanged === true && receipt.terminal_status === report.actor_status;
  const traditionalScriptFailure = lifecycleComplete && report.framework === 'playwright' &&
    report.actor_status === 'execution-error';
  rows.push({attempt: path.basename(root), report_sha256: sha(bytes),
    configuration_sha256: sha(fs.readFileSync(path.join(root, 'configuration.json'))),
    traditional_script_sha256: report.framework === 'playwright' ? configuration.script_sha256 ?? null : null,
    task_id: report.task_id, framework: report.framework, mode: report.mode,
    model: report.model?.model ?? null, official_score: report.official_score ?? null,
    actor_status: report.actor_status ?? null, failure_class: report.failure_class ?? null,
    engineering_error: report.engineering_error ?? null, provider_requests: report.provider_requests ?? null,
    actions: report.actions ?? null, reset_elapsed_ms: report.reset_elapsed_ms ?? null,
    actor_elapsed_ms: receipt.elapsed_ms ?? null,
    lifecycle_complete: lifecycleComplete,
    // A broken authored script is not a successful capability run, but must
    // remain visible in the Traditional deployment-effectiveness denominator.
    traditional_script_failure_retained: traditionalScriptFailure,
    analysis_eligible: lifecycleComplete && ['completed', 'failed', 'invalid-action', 'timeout'].includes(report.actor_status),
  });
}
if (new Set(rows.map(row => row.attempt)).size !== rows.length) throw Error('Duplicate attempt labels');
const result = {schema: 'pss-wav-official-attempt-summary-v1', scope: 'diagnostic',
  confirmatory_authorized: false, generated_at: new Date().toISOString(), task_id: taskId,
  attempted_processes: rows.length,
  lifecycle_complete_attempts: rows.filter(row => row.lifecycle_complete).length,
  analysis_eligible_attempts: rows.filter(row => row.analysis_eligible).length,
  traditional_script_failures_retained: rows.filter(row => row.traditional_script_failure_retained).length,
  pooled_comparative_claim_authorized: false, attempts: rows};
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx', mode: 0o600});
console.log(JSON.stringify({task_id: taskId, attempted_processes: result.attempted_processes,
  analysis_eligible_attempts: result.analysis_eligible_attempts}));
