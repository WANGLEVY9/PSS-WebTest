import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const file = process.env.PSS_AGENT_MODEL_MATRIX ?? path.join(root, 'config', 'prestashop-agent-model-matrix.v0.1.json');
const matrix = JSON.parse(fs.readFileSync(file, 'utf8'));
const errors = [];
if (matrix.schema_version !== '0.1') errors.push('schema_version must be 0.1');
if (matrix.application !== 'prestashop') errors.push('application must be prestashop');
if (JSON.stringify(matrix.arm_scope) !== JSON.stringify(['visual', 'hybrid'])) errors.push('arm_scope must preserve visual and hybrid');
if (!matrix.models?.length) errors.push('at least one provider/model stratum is required');
const ids = new Set();
for (const model of matrix.models ?? []) {
  for (const field of ['id', 'provider', 'model', 'key_env', 'profile']) if (typeof model[field] !== 'string' || !model[field]) errors.push(`model ${model.id ?? '?'} missing ${field}`);
  if (ids.has(model.id)) errors.push(`duplicate model id ${model.id}`); ids.add(model.id);
  if (model.image_input !== true) errors.push(`model ${model.id} must declare image_input=true`);
}
if (matrix.execution_contract?.failure_policy !== 'stop-on-sut-or-provider-health-failure') errors.push('matrix must stop on health failure');
if (errors.length) { console.error(JSON.stringify({ status: 'invalid', errors }, null, 2)); process.exit(1); }
console.log(JSON.stringify({ status: 'valid', campaign_id: matrix.campaign_id, models: matrix.models.map(({ id, provider, model, status }) => ({ id, provider, model, status })), arms: matrix.arm_scope, distribution: matrix.complexity_distribution, evidence_boundary: matrix.execution_contract.evidence_boundary }, null, 2));
