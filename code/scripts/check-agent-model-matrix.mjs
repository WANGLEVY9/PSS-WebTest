import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const matrixPath = process.env.PSS_AGENT_MODEL_MATRIX ?? path.join(codeRoot, 'config', 'prestashop-agent-model-matrix.v0.1.json');
dotenv.config({ path: path.join(codeRoot, '.env') });
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
const configuredProvider = process.env.CUA_PROVIDER?.trim() || null;
const configuredModel = process.env.CUA_MODEL?.trim() || null;
const hasKey = Boolean(process.env.CUA_API_KEY?.trim());
const rows = matrix.models.map((model) => ({
  id: model.id,
  provider: model.provider,
  model: model.model,
  image_input: model.image_input === true,
  local_env_match: configuredProvider === model.provider && configuredModel === model.model,
  api_key_present: configuredProvider === model.provider && configuredModel === model.model ? hasKey : false,
  readiness: configuredProvider === model.provider && configuredModel === model.model && hasKey ? 'configured-current' : 'awaiting-local-key-or-env-switch'
}));
console.log(JSON.stringify({ status: 'ok', configured_stratum: configuredProvider && configuredModel ? `${configuredProvider}/${configuredModel}` : null, rows, note: 'A key is reported only as present/absent; its value is never printed.' }, null, 2));
