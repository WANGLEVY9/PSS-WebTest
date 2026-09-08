import crypto from 'node:crypto';
import { findConfiguration } from './configuration-registry.mjs';

const SENSITIVE_KEY = /(api[_-]?key|authorization|cookie|password|secret|access[_-]?token|refresh[_-]?token|auth[_-]?token|credential)/i;
const SENSITIVE_VALUE = /(sk-[A-Za-z0-9_-]{12,}|bearer\s+[A-Za-z0-9._-]{12,})/i;
const STATUSES = new Set(['completed', 'test-failure', 'timeout', 'model-refusal', 'infrastructure-error', 'evaluator-error']);
const ARMS = new Set(['visual', 'hybrid', 'playwright']);
const VERDICTS = new Set(['clean', 'fault', 'unknown', 'not-emitted']);
const TRUTH = new Set(['clean', 'fault', 'unknown', 'not-scored']);
const CONTRACTS = new Set(['screenshot-only', 'screenshot-plus-structure', 'scripted-locator']);
const FAMILY_BY_ARM = Object.freeze({ visual: 'visual', hybrid: 'hybrid', playwright: 'scripted' });
const CONTRACT_BY_FAMILY = Object.freeze({ visual: 'screenshot-only', hybrid: 'screenshot-plus-structure', scripted: 'scripted-locator' });
const AUTHORING_SOURCES = new Set(['human', 'llm-generated', 'llm-repaired']);
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

function assertAllowedKeys(record, allowed, location = 'run record') {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) throw new Error(`${location} contains unsupported field: ${key}`);
  }
}

function validateCommonRunRecord(record) {
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
}

function validateRunRecordV01(record) {
  assertAllowedKeys(record, new Set(['schema_version', 'run_id', 'application_id', 'application_version', 'task_id', 'condition', 'arm', 'status', 'checkpoint_reached', 'emitted_verdict', 'ground_truth_verdict', 'timing', 'provenance', 'failure_category']));
  assertAllowedKeys(record.provenance, new Set(['runner_version', 'trace_hash', 'observation_contract', 'model_id', 'seed']), 'run record provenance');
}

function validateRunRecordV02(record) {
  const required = ['configuration_id', 'strategy_family', 'protocol_version', 'run_manifest_digest', 'sut_image_digest', 'reset_digest', 'randomization_block'];
  for (const field of required) if (!(field in record)) throw new Error(`v0.2 run record missing required field: ${field}`);
  assertAllowedKeys(record, new Set(['schema_version', 'run_id', 'application_id', 'application_version', 'task_id', 'condition', 'arm', 'status', 'checkpoint_reached', 'emitted_verdict', 'ground_truth_verdict', 'timing', 'provenance', 'failure_category', ...required]));
  if (!/^[a-z0-9][a-z0-9-]{2,127}$/.test(record.configuration_id)) throw new Error('v0.2 configuration_id is invalid');
  const expectedFamily = FAMILY_BY_ARM[record.arm];
  if (record.strategy_family !== expectedFamily) throw new Error(`v0.2 strategy_family must be ${expectedFamily} for arm ${record.arm}`);
  if (typeof record.protocol_version !== 'string' || !record.protocol_version.trim()) throw new Error('v0.2 protocol_version must be non-empty');
  for (const field of ['run_manifest_digest', 'sut_image_digest', 'reset_digest']) {
    if (!/^[a-f0-9]{64}$/.test(record[field])) throw new Error(`v0.2 ${field} must be a SHA-256 hex digest`);
  }
  if (typeof record.randomization_block !== 'string' || !record.randomization_block.trim()) throw new Error('v0.2 randomization_block must be non-empty');

  const p = record.provenance;
  const provenanceFields = ['runner_version', 'trace_hash', 'observation_contract', 'model_id', 'seed', 'framework_id', 'framework_version', 'provider_id', 'prompt_digest', 'action_schema_version', 'code_framework', 'authoring_source', 'environment_digest'];
  for (const field of provenanceFields) if (!(field in p)) throw new Error(`v0.2 provenance missing required field: ${field}`);
  assertAllowedKeys(p, new Set(provenanceFields), 'v0.2 run record provenance');
  if (p.observation_contract !== CONTRACT_BY_FAMILY[record.strategy_family]) throw new Error('v0.2 provenance observation_contract conflicts with strategy_family');
  for (const field of ['framework_id', 'framework_version']) if (typeof p[field] !== 'string' || !p[field].trim()) throw new Error(`v0.2 provenance.${field} must be non-empty`);
  if (!/^[a-f0-9]{64}$/.test(p.environment_digest)) throw new Error('v0.2 provenance.environment_digest must be a SHA-256 hex digest');

  if (record.strategy_family === 'scripted') {
    for (const field of ['provider_id', 'model_id', 'prompt_digest', 'action_schema_version']) if (p[field] !== null) throw new Error(`v0.2 scripted provenance.${field} must be null`);
    if (typeof p.code_framework !== 'string' || !p.code_framework.trim()) throw new Error('v0.2 scripted provenance.code_framework must be non-empty');
    if (!AUTHORING_SOURCES.has(p.authoring_source)) throw new Error('v0.2 scripted provenance.authoring_source is invalid');
  } else {
    for (const field of ['provider_id', 'model_id', 'prompt_digest', 'action_schema_version']) if (typeof p[field] !== 'string' || !p[field].trim()) throw new Error(`v0.2 agent provenance.${field} must be non-empty`);
    if (!/^[a-f0-9]{64}$/.test(p.prompt_digest)) throw new Error('v0.2 agent provenance.prompt_digest must be a SHA-256 hex digest');
    if (p.code_framework !== null || p.authoring_source !== null) throw new Error('v0.2 agent code provenance must be null');
  }
}

export function validateRunRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('run record must be an object');
  if (!['0.1', '0.2'].includes(record.schema_version)) throw new Error(`unsupported run record schema_version: ${record.schema_version}`);
  validateCommonRunRecord(record);
  if (record.schema_version === '0.1') validateRunRecordV01(record);
  if (record.schema_version === '0.2') validateRunRecordV02(record);
  assertSafe(record);
  return record;
}

/**
 * Validate a v0.2 run against the frozen configuration registry.  Keep this
 * separate from validateRunRecord() so historical v0.1 ledgers remain readable
 * without retroactively inventing configuration metadata.
 */
export function validateRunRecordAgainstRegistry(record, registry) {
  validateRunRecord(record);
  if (record.schema_version === '0.1') return record;
  const configuration = findConfiguration(registry, record.configuration_id);
  if (!['implemented', 'admitted'].includes(configuration.status)) throw new Error(`configuration ${configuration.configuration_id} is not executable for v0.2 collection`);
  if (configuration.family !== record.strategy_family) throw new Error('configuration registry family conflicts with run record strategy_family');
  if (configuration.observation_contract !== record.provenance.observation_contract) throw new Error('configuration registry observation contract conflicts with run record');
  if (configuration.framework.id !== record.provenance.framework_id || configuration.framework.version !== record.provenance.framework_version) throw new Error('configuration registry framework conflicts with run record');
  if (record.protocol_version !== registry.protocol_version) throw new Error('configuration registry protocol_version conflicts with run record');
  if (record.strategy_family === 'scripted') {
    if (configuration.test_implementation.code_framework !== record.provenance.code_framework || configuration.test_implementation.authoring_source !== record.provenance.authoring_source) throw new Error('configuration registry scripted implementation conflicts with run record');
  } else {
    for (const field of ['provider_id', 'model_id', 'action_schema_version', 'prompt_digest']) {
      if (configuration.runtime[field] !== record.provenance[field]) throw new Error(`configuration registry runtime.${field} conflicts with run record`);
    }
  }
  return record;
}

export function createRunRecord(input) {
  const { trace = [], ...fields } = input || {};
  assertSafe(fields);
  assertSafe(trace, '$.trace');
  const schemaVersion = fields.schema_version ?? '0.1';
  const record = {
    schema_version: schemaVersion,
    ...fields,
    timing: { tokens: null, cost_usd: null, ...(fields.timing || {}) },
    provenance: { model_id: null, seed: null, ...(fields.provenance || {}), trace_hash: traceHash(trace) }
  };
  // Explicitly whitelist the immutable schema; traces and arbitrary provider metadata never leave this function.
  const allowed = schemaVersion === '0.2'
    ? ['schema_version', 'run_id', 'application_id', 'application_version', 'task_id', 'condition', 'arm', 'status', 'checkpoint_reached', 'emitted_verdict', 'ground_truth_verdict', 'timing', 'provenance', 'failure_category', 'configuration_id', 'strategy_family', 'protocol_version', 'run_manifest_digest', 'sut_image_digest', 'reset_digest', 'randomization_block']
    : ['schema_version', 'run_id', 'application_id', 'application_version', 'task_id', 'condition', 'arm', 'status', 'checkpoint_reached', 'emitted_verdict', 'ground_truth_verdict', 'timing', 'provenance', 'failure_category'];
  const output = Object.fromEntries(allowed.filter((key) => record[key] !== undefined).map((key) => [key, record[key]]));
  if (!('failure_category' in output)) output.failure_category = null;
  return validateRunRecord(output);
}
