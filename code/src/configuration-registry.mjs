import fs from 'node:fs';
import path from 'node:path';

const FAMILIES = new Set(['visual', 'hybrid', 'scripted']);
const STATUSES = new Set(['candidate', 'implemented', 'legacy-pilot', 'admitted', 'retired']);
const ADMISSION_STATUSES = new Set(['not-started', 'conformance-passed', 'pilot-only', 'clean-admitted', 'frozen']);
const CONTRACT_BY_FAMILY = Object.freeze({
  visual: 'screenshot-only',
  hybrid: 'screenshot-plus-structure',
  scripted: 'scripted-locator'
});
const AUTHORING_SOURCES = new Set(['human', 'llm-generated', 'llm-repaired']);
const CONFIGURATION_ID = /^[a-z0-9][a-z0-9-]{2,127}$/;

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertExactKeys(value, allowed, location, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${location} must be an object`);
    return;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${location}.${key} is not allowed`);
  }
}

function validateConfiguration(configuration, index, seenIds, errors) {
  const location = `configurations[${index}]`;
  const topLevelKeys = new Set(['configuration_id', 'family', 'status', 'framework', 'observation_contract', 'runtime', 'test_implementation', 'admission']);
  assertExactKeys(configuration, topLevelKeys, location, errors);
  if (!CONFIGURATION_ID.test(configuration?.configuration_id ?? '')) errors.push(`${location}.configuration_id is invalid`);
  if (seenIds.has(configuration?.configuration_id)) errors.push(`duplicate configuration_id: ${configuration.configuration_id}`);
  seenIds.add(configuration?.configuration_id);
  if (!FAMILIES.has(configuration?.family)) errors.push(`${location}.family is invalid`);
  if (!STATUSES.has(configuration?.status)) errors.push(`${location}.status is invalid`);

  assertExactKeys(configuration?.framework, new Set(['id', 'version']), `${location}.framework`, errors);
  if (!isNonEmptyString(configuration?.framework?.id)) errors.push(`${location}.framework.id is required`);
  if (!isNonEmptyString(configuration?.framework?.version)) errors.push(`${location}.framework.version is required`);

  const expectedContract = CONTRACT_BY_FAMILY[configuration?.family];
  if (configuration?.observation_contract !== expectedContract) {
    errors.push(`${location}.observation_contract must be ${expectedContract ?? 'a known contract'} for ${configuration?.family ?? 'the declared family'}`);
  }

  assertExactKeys(configuration?.runtime, new Set(['provider_id', 'model_id', 'action_schema_version', 'prompt_digest']), `${location}.runtime`, errors);
  assertExactKeys(configuration?.test_implementation, new Set(['code_framework', 'authoring_source']), `${location}.test_implementation`, errors);
  const isAgentFamily = configuration?.family === 'visual' || configuration?.family === 'hybrid';
  if (isAgentFamily) {
    for (const field of ['provider_id', 'model_id', 'action_schema_version', 'prompt_digest']) {
      if (!isNonEmptyString(configuration?.runtime?.[field])) errors.push(`${location}.runtime.${field} is required for an agent configuration`);
    }
    if (configuration?.test_implementation?.code_framework !== null || configuration?.test_implementation?.authoring_source !== null) {
      errors.push(`${location}.test_implementation must be null-valued for an agent configuration`);
    }
  }
  if (configuration?.family === 'scripted') {
    for (const field of ['provider_id', 'model_id', 'action_schema_version', 'prompt_digest']) {
      if (configuration?.runtime?.[field] !== null) errors.push(`${location}.runtime.${field} must be null for a scripted configuration`);
    }
    if (!isNonEmptyString(configuration?.test_implementation?.code_framework)) errors.push(`${location}.test_implementation.code_framework is required for scripted`);
    if (!AUTHORING_SOURCES.has(configuration?.test_implementation?.authoring_source)) errors.push(`${location}.test_implementation.authoring_source is invalid for scripted`);
  }

  assertExactKeys(configuration?.admission, new Set(['status', 'evidence']), `${location}.admission`, errors);
  if (!ADMISSION_STATUSES.has(configuration?.admission?.status)) errors.push(`${location}.admission.status is invalid`);
  if (!Array.isArray(configuration?.admission?.evidence) || !configuration.admission.evidence.every(isNonEmptyString)) errors.push(`${location}.admission.evidence must be an array of non-empty strings`);
  if (configuration?.status === 'admitted' && !['clean-admitted', 'frozen'].includes(configuration?.admission?.status)) errors.push(`${location}.admitted configuration lacks admission evidence`);
}

export function validateConfigurationRegistry(registry) {
  const errors = [];
  assertExactKeys(registry, new Set(['schema_version', 'protocol_version', 'purpose', 'configurations']), '$', errors);
  if (registry?.schema_version !== '0.2') errors.push('schema_version must be 0.2');
  if (!isNonEmptyString(registry?.protocol_version)) errors.push('protocol_version is required');
  if (!isNonEmptyString(registry?.purpose)) errors.push('purpose is required');
  if (!Array.isArray(registry?.configurations) || registry.configurations.length === 0) {
    errors.push('configurations must be a non-empty array');
  } else {
    const seenIds = new Set();
    registry.configurations.forEach((configuration, index) => validateConfiguration(configuration, index, seenIds, errors));
  }
  if (errors.length) throw new Error(`Configuration registry validation failed (${errors.length} error(s)):\n${errors.map((error) => `- ${error}`).join('\n')}`);
  return registry;
}

export function loadConfigurationRegistry(registryPath = path.resolve(new URL('..', import.meta.url).pathname, 'config/configuration-registry.v0.2.json')) {
  return validateConfigurationRegistry(JSON.parse(fs.readFileSync(registryPath, 'utf8')));
}

export function findConfiguration(registry, configurationId) {
  validateConfigurationRegistry(registry);
  const configuration = registry.configurations.find((item) => item.configuration_id === configurationId);
  if (!configuration) throw new Error(`unknown configuration_id: ${configurationId}`);
  return configuration;
}

export { CONTRACT_BY_FAMILY };
