import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { findConfiguration } from './configuration-registry.mjs';

const SENSITIVE_ENVIRONMENT_KEY = /(api[_-]?key|authorization|cookie|password|secret|access[_-]?token|refresh[_-]?token|auth[_-]?token|credential)/i;

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(canonical(value))).digest('hex');
}

export function fileDigest(filePath) {
  return sha256(fs.readFileSync(filePath, 'utf8'));
}

function requireDigest(value, name) {
  if (!/^[a-f0-9]{64}$/.test(value ?? '')) throw new Error(`${name} must be a SHA-256 hex digest`);
  return value;
}

function safeEnvironmentDigest(environment) {
  if (!environment || typeof environment !== 'object' || Array.isArray(environment)) throw new Error('environment must be a plain object');
  for (const key of Object.keys(environment)) {
    if (SENSITIVE_ENVIRONMENT_KEY.test(key)) throw new Error(`environment key is not allowed in provenance: ${key}`);
  }
  return sha256(environment);
}

export function imageDigestFromTaskManifest({ taskManifestPath, applicationId }) {
  const manifest = JSON.parse(fs.readFileSync(taskManifestPath, 'utf8'));
  const application = manifest.applications?.find((item) => item.id === applicationId);
  if (!application) throw new Error(`application ${applicationId} is not in the task manifest`);
  const rawDigest = application.source?.built_image ?? application.source?.image;
  // Docker references may be stored either as a bare sha256 digest or as an
  // image reference such as registry.example/app@sha256:<digest>.
  const digest = typeof rawDigest === 'string'
    ? (rawDigest.match(/(?:^|@)sha256:([a-f0-9]{64})$/)?.[1] ?? rawDigest.replace(/^sha256:/, ''))
    : '';
  return requireDigest(digest, `${applicationId} image digest`);
}

/**
 * Produce the fields that make a run record a Phase 2 v0.2 record. Callers
 * still provide the run-specific status, timing and trace. No credentials or
 * raw environment values are retained.
 */
export function createPhase2Provenance({
  registry,
  configurationId,
  runManifestPath,
  taskManifestPath,
  applicationId,
  resetDigest,
  randomizationBlock,
  environment
}) {
  const configuration = findConfiguration(registry, configurationId);
  if (!['implemented', 'admitted'].includes(configuration.status)) throw new Error(`configuration ${configurationId} is not eligible for a v0.2 run`);
  if (typeof randomizationBlock !== 'string' || !randomizationBlock.trim()) throw new Error('randomizationBlock is required');
  const environmentDigest = safeEnvironmentDigest(environment);
  const runtime = configuration.runtime;
  return {
    schema_version: '0.2',
    configuration_id: configuration.configuration_id,
    strategy_family: configuration.family,
    protocol_version: registry.protocol_version,
    run_manifest_digest: fileDigest(path.resolve(runManifestPath)),
    sut_image_digest: imageDigestFromTaskManifest({ taskManifestPath: path.resolve(taskManifestPath), applicationId }),
    reset_digest: requireDigest(resetDigest, 'resetDigest'),
    randomization_block: randomizationBlock,
    provenance: {
      framework_id: configuration.framework.id,
      framework_version: configuration.framework.version,
      provider_id: runtime.provider_id,
      model_id: runtime.model_id,
      prompt_digest: runtime.prompt_digest,
      action_schema_version: runtime.action_schema_version,
      code_framework: configuration.test_implementation.code_framework,
      authoring_source: configuration.test_implementation.authoring_source,
      environment_digest: environmentDigest
    }
  };
}
