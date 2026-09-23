// Merge disjoint/resumed diagnostic slices without hiding failed attempts.
// Reads only reports and receipts; never exports prompts, screenshots or gold.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [output, ...inputs] = process.argv.slice(2);
if (!output || inputs.length === 0) throw Error('Usage: node tools/merge-wav-qwen-pair.mjs NEW_EXPORT.json BATCH_DIR...');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const plans = [];
const attempts = [];
let referenceJobs;
for (const name of inputs) {
  const root = path.resolve(name);
  const planBytes = fs.readFileSync(path.join(root, 'plan.json'));
  const plan = JSON.parse(planBytes);
  if (plan.schema !== 'pss-qwen38-paired-acceptance-v1' || plan.scope !== 'diagnostic' || plan.confirmatory_authorized !== false)
    throw Error('Unrecognized diagnostic plan');
  if (referenceJobs && JSON.stringify(plan.jobs) !== JSON.stringify(referenceJobs)) throw Error('Job identity drift across slices');
  referenceJobs ??= plan.jobs;
  const batch = path.basename(root);
  if (plans.some(p => p.batch === batch)) throw Error('Duplicate batch label');
  plans.push({batch, plan_sha256: sha(planBytes), source_sha256: plan.source_sha256});
  for (const [index, job] of plan.jobs.entries()) {
    const stem = `${String(index).padStart(2, '0')}-${job.model || 'shared'}-${job.task_id}-${job.framework}-${job.mode}`;
    const reportFile = path.join(root, stem, 'report.json');
    const processFile = path.join(root, `${String(index).padStart(2, '0')}-process.log`);
    if (!fs.existsSync(reportFile) && !fs.existsSync(processFile)) continue;
    const row = {batch, index, ...job, status: 'attempted-no-sealed-report'};
    if (fs.existsSync(reportFile)) {
      const bytes = fs.readFileSync(reportFile);
      const report = JSON.parse(bytes);
      if (report.task_id !== job.task_id || report.framework !== job.framework || report.mode !== job.mode ||
          (report.model?.model ?? null) !== job.model || report.confirmatory_authorized !== false)
        throw Error('Sealed report identity drift');
      const receiptFile = path.join(root, stem, 'trajectory', 'actor-receipt.json');
      const receipt = fs.existsSync(receiptFile) ? JSON.parse(fs.readFileSync(receiptFile)) : {};
      Object.assign(row, {
        status: 'sealed', report_sha256: sha(bytes), official_task_started: report.official_task_started === true,
        actor_status: report.actor_status ?? null, failure_class: report.failure_class ?? null,
        official_score: report.official_score ?? null, assessment_status: report.assessment_status ?? null,
        provider_requests: report.provider_requests ?? null, actions: report.actions ?? null,
        reset_elapsed_ms: report.reset_elapsed_ms ?? null, actor_elapsed_ms: receipt.elapsed_ms ?? null,
        chain_valid: report.official_task_started === true && report.official_task_completed === true &&
          report.assessment_status === 'valid' &&
          report.owned_cleanup_completed === true && !report.engineering_error && !report.cleanup_error &&
          report.replay?.passed === true && receipt.source_tree_unchanged === true &&
          receipt.terminal_status === report.actor_status,
      });
    }
    attempts.push(row);
  }
}
const cells = referenceJobs.map((job, index) => {
  const all = attempts.filter(a => a.index === index);
  const valid = all.filter(a => a.chain_valid === true);
  return {index, ...job, attempted: all.length, valid_chains: valid.length,
    status: valid.length === 1 ? 'one-valid-chain' : valid.length > 1 ? 'ambiguous-multiple-valid-chains' :
      all.length ? 'attempted-no-valid-chain' : 'unstarted',
    selected_batch: valid.length === 1 ? valid[0].batch : null,
    official_score: valid.length === 1 ? valid[0].official_score : null,
    source_variant: valid.length === 1 ? plans.find(p => p.batch === valid[0].batch)?.source_sha256 : null};
});
const result = {schema: 'pss-qwen38-multislice-diagnostic-v1', scope: 'diagnostic', confirmatory_authorized: false,
  generated_at: new Date().toISOString(), planned_cells: referenceJobs.length,
  distinct_official_tasks: [...new Set(referenceJobs.map(j => j.task_id))].length,
  attempted_processes: attempts.length, valid_cells: cells.filter(c => c.status === 'one-valid-chain').length,
  source_variants: [...new Set(plans.map(p => p.source_sha256))],
  pooled_comparative_claim_authorized: false, shared_traditional_counted_once: true,
  plans, cells, attempts};
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx', mode: 0o600});
console.log(JSON.stringify({planned_cells: result.planned_cells, attempted_processes: result.attempted_processes,
  valid_cells: result.valid_cells, source_variants: result.source_variants.length}));
