import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const plan = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config/prestashop-agent-500-batch.v0.1.json'), 'utf8'));
const expected = { simple: 200, medium: 175, complex: 125 };
if (plan.target_executions_per_arm !== 500) throw new Error('target_executions_per_arm must remain 500');
if (JSON.stringify(plan.complexity_distribution) !== JSON.stringify(expected)) throw new Error('complexity distribution must remain 200/175/125');
if (JSON.stringify(plan.arms) !== JSON.stringify(['visual', 'hybrid'])) throw new Error('plan must contain exactly visual and hybrid arms');
if (plan.guardrails.max_concurrency_per_arm !== 1) throw new Error('agent batch concurrency is intentionally capped at one worker per arm');
if (plan.provider_stratum.provider !== 'aliyun' || plan.provider_stratum.model !== 'qwen3.7-flash') throw new Error('provider/model stratum changed unexpectedly');
for (const workflow of plan.workflows) {
  if (!['simple', 'medium', 'complex'].includes(workflow.complexity)) throw new Error(`invalid complexity: ${workflow.complexity}`);
  if (!workflow.id.startsWith('prestashop-')) throw new Error(`invalid workflow id: ${workflow.id}`);
  if (!workflow.oracle || workflow.mutates_application_state !== false) throw new Error(`workflow contract incomplete: ${workflow.id}`);
}
console.log(JSON.stringify({ status: 'valid', plan_id: plan.id, target_per_arm: plan.target_executions_per_arm, distribution: plan.complexity_distribution, arms: plan.arms, provider_stratum: plan.provider_stratum, evidence_boundary: plan.status }));
