import crypto from 'node:crypto';

const SENSITIVE_KEY = /(api[_-]?key|authorization|cookie|password|secret|access[_-]?token|refresh[_-]?token|auth[_-]?token|credential)/i;
const SENSITIVE_VALUE = /(sk-[A-Za-z0-9_-]{12,}|bearer\s+[A-Za-z0-9._-]{12,})/i;
const STATUSES = new Set(['completed', 'test-failure', 'timeout', 'model-refusal', 'infrastructure-error', 'evaluator-error']);
const ARMS = new Set(['visual', 'hybrid', 'playwright']);
const VERDICTS = new Set(['clean', 'fault', 'unknown', 'not-emitted']);
const TRUTH = new Set(['clean', 'fault', 'unknown', 'not-scored']);
const CONTRACTS = new Set(['screenshot-only', 'screenshot-plus-structure', 'scripted-locator']);
const FAILURE_CATEGORIES = new Set([
  'perception', 'grounding', 'planning', 'execution', 'oracle', 'environment', 'task-defect',
  'provider', 'provider-timeout', 'provider-api', 'provider-format', 'grounding-loop',
  'agent-step-budget', 'termination-verdict', 'agent-verdict'
]);

function assertSafe(value, path = '$') {
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (SENSITIVE_KEY.test(key)) throw new Error(`sensitive field is not allowed in run record input: ${path}.${key}`);
      assertSafe(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === 'string' && SENSITIVE_VALUE.test(value)) throw new Error(`sensitive credential-like value is not allowed at ${path}`);
}

function canonical(value) {
  if (value === undefined) return null;
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  return value;
}

export function traceHash(trace = []) {
  return crypto.createHash('sha256').update(JSON.stringify(canonical(trace))).digest('hex');
}

export function validateRunRecord(record) {
  const required = ['schema_version', 'run_id', 'application_id', 'application_version', 'task_id', 'condition', 'arm', 'status', 'checkpoint_reached', 'emitted_verdict', 'ground_truth_verdict', 'timing', 'provenance'];
  for (const field of required) if (!(field in record)) throw new Error(`run record missing required field: ${field}`);
  if (!/^[a-zA-Z0-9._-]+$/.test(record.run_id)) throw new Error('run_id contains unsupported characters');
  if (!ARMS.has(record.arm)) throw new Error(`unsupported arm: ${record.arm}`);
  if (!STATUSES.has(record.status)) throw new Error(`unsupported status: ${record.status}`);
  if (!VERDICTS.has(record.emitted_verdict)) throw new Error(`unsupported emitted_verdict: ${record.emitted_verdict}`);
  if (!TRUTH.has(record.ground_truth_verdict)) throw new Error(`unsupported ground_truth_verdict: ${record.ground_truth_verdict}`);
  if (typeof record.checkpoint_reached !== 'boolean') throw new Error('checkpoint_reached must be boolean');
  const t = record.timing;
  for (const field of ['wall_time_ms', 'actions', 'retries']) if (!Number.isFinite(t[field]) || t[field] < 0) throw new Error(`invalid timing.${field}`);
  for (const field of ['tokens', 'cost_usd']) if (t[field] !== undefined && t[field] !== null && (!Number.isFinite(t[field]) || t[field] < 0)) throw new Error(`invalid timing.${field}`);
  const p = record.provenance;
  for (const field of ['runner_version', 'trace_hash', 'observation_contract']) if (!(field in p)) throw new Error(`provenance missing required field: ${field}`);
  if (!CONTRACTS.has(p.observation_contract)) throw new Error(`unsupported observation_contract: ${p.observation_contract}`);
  if (!/^[a-f0-9]{64}$/.test(p.trace_hash)) throw new Error('trace_hash must be a SHA-256 hex digest');
  if (record.failure_category !== null && record.failure_category !== undefined && !FAILURE_CATEGORIES.has(record.failure_category)) {
    throw new Error(`unsupported failure_category: ${record.failure_category}`);
  }
  assertSafe(record);
  return record;
}

export function createRunRecord(input) {
  const { trace = [], ...fields } = input || {};
  assertSafe(fields);
  assertSafe(trace, '$.trace');
  const record = {
    schema_version: '0.1',
    ...fields,
    timing: { tokens: null, cost_usd: null, ...(fields.timing || {}) },
    provenance: { model_id: null, seed: null, ...(fields.provenance || {}), trace_hash: traceHash(trace) }
  };
  // Explicitly whitelist the immutable schema; traces and arbitrary provider metadata never leave this function.
  const allowed = ['schema_version', 'run_id', 'application_id', 'application_version', 'task_id', 'condition', 'arm', 'status', 'checkpoint_reached', 'emitted_verdict', 'ground_truth_verdict', 'timing', 'provenance', 'failure_category'];
  const output = Object.fromEntries(allowed.filter((key) => record[key] !== undefined).map((key) => [key, record[key]]));
  if (!('failure_category' in output)) output.failure_category = null;
  return validateRunRecord(output);
}
