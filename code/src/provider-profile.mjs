import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export const providerProfileManifestPath = path.join(codeRoot, 'config', 'provider-profile-manifest.v0.1.json');

const ACTION_MODES = new Set(['tool', 'json']);
const API_MODES = new Set(['chat', 'responses']);
const PROFILE_STATUSES = new Set([
  'frozen-pilot',
  'legacy-registered-model',
  'legacy-pilot-not-for-collection',
  'retired'
]);
const READINESS_STATUSES = new Set(['pending', 'ready', 'blocked', 'not-for-collection']);

// Historical implicit driver defaults. They are kept only so unknown
// provider/model pairs (for example a local test double) remain resolvable, and
// they are reported as `legacy-default` so the drift is auditable rather than
// silent. The matched experiment path sets PSS_REQUIRE_FROZEN_PROFILE=1 and
// therefore never reaches this branch.
const LEGACY_ACTION_MODE = Object.freeze({ aliyun: 'tool', deepseek: 'tool', volcengine: 'json' });
const LEGACY_API_MODE = Object.freeze({ aliyun: 'chat', deepseek: 'chat', volcengine: 'chat' });

export class ProviderProfileNotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProviderProfileNotFoundError';
  }
}

export class ProviderProfileViolationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProviderProfileViolationError';
  }
}

export function loadProviderProfileManifest({ manifestPath = providerProfileManifestPath } = {}) {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

export function findProviderProfile({ provider, model, document = loadProviderProfileManifest() }) {
  if (!provider || !model) return null;
  return document.profiles.find((profile) => profile.provider_id === provider && profile.model_id === model) ?? null;
}

function envOverride(env, key) {
  if (!key) return undefined;
  const value = env?.[key];
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseIntStrict(value, field, { minimum = 0 } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < minimum) throw new ProviderProfileViolationError(`${field} must be an integer >= ${minimum}`);
  return parsed;
}

/**
 * Resolve the provider protocol for one arm.
 *
 * Precedence: explicit environment override -> frozen profile -> legacy
 * implicit default. `action_mode_source` and `api_mode_source` make the chosen
 * layer explicit so a protocol change can never be reported as a strategy
 * effect.
 */
export function resolveProviderProtocol({ env = process.env, provider, model, arm = 'visual', strict = false } = {}) {
  if (!['visual', 'hybrid'].includes(arm)) throw new ProviderProfileViolationError(`Unsupported arm: ${arm}`);
  const document = loadProviderProfileManifest();
  const profile = findProviderProfile({ provider, model, document });
  const requireFrozen = strict || env?.PSS_REQUIRE_FROZEN_PROFILE === '1';
  if (!profile && requireFrozen) {
    throw new ProviderProfileNotFoundError(`No frozen provider profile for ${provider ?? '(unset provider)'}/${model ?? '(unset model)'}; add it to ${path.basename(providerProfileManifestPath)} before running a matched cell`);
  }

  const overrides = profile?.env_overrides ?? {};
  const envActionMode = envOverride(env, overrides.action_mode);
  const envApiMode = envOverride(env, overrides.api_mode);

  const profileActionMode = profile?.action_mode;
  const profileApiMode = profile?.api_mode;
  const actionMode = envActionMode ?? profileActionMode ?? LEGACY_ACTION_MODE[provider];
  const apiMode = envApiMode ?? profileApiMode ?? LEGACY_API_MODE[provider] ?? 'chat';

  if (!ACTION_MODES.has(actionMode)) {
    throw new ProviderProfileViolationError(`Resolved action mode must be tool or json (got ${actionMode}) for ${provider}/${model}`);
  }
  if (!API_MODES.has(apiMode)) {
    throw new ProviderProfileViolationError(`Resolved api mode must be chat or responses (got ${apiMode}) for ${provider}/${model}`);
  }

  const envMaxOutputTokens = envOverride(env, overrides.max_output_tokens);
  const envMaxRetries = envOverride(env, overrides.max_retries);
  const envMaxDecisionRetries = envOverride(env, overrides.max_decision_retries);
  const envCoordinateMode = envOverride(env, overrides.coordinate_mode);

  return {
    profile_id: profile?.profile_id ?? null,
    profile_status: profile?.status ?? null,
    provider_id: provider ?? null,
    model_id: model ?? null,
    arm,
    frozen: Boolean(profile),
    optimization_profile: profile?.optimization_profile ?? null,
    prompt_profile: profile?.prompt_profile ?? null,
    action_schema_version: profile?.action_schema_version ?? null,
    action_mode: actionMode,
    action_mode_source: envActionMode ? 'env-override' : profileActionMode ? 'frozen-profile' : 'legacy-default',
    api_mode: apiMode,
    api_mode_source: envApiMode ? 'env-override' : profileApiMode ? 'frozen-profile' : 'legacy-default',
    coordinate_mode: envCoordinateMode ?? profile?.coordinate_mode ?? null,
    coordinate_mode_source: envCoordinateMode ? 'env-override' : profile?.coordinate_mode ? 'frozen-profile' : 'legacy-default',
    max_output_tokens: envMaxOutputTokens !== undefined
      ? parseIntStrict(envMaxOutputTokens, 'CUA_MAX_OUTPUT_TOKENS', { minimum: 1 })
      : profile?.max_output_tokens ?? null,
    max_retries: envMaxRetries !== undefined
      ? parseIntStrict(envMaxRetries, 'CUA_MAX_RETRIES')
      : profile?.max_retries ?? null,
    max_decision_retries: envMaxDecisionRetries !== undefined
      ? parseIntStrict(envMaxDecisionRetries, 'CUA_MAX_DECISION_RETRIES')
      : profile?.max_decision_retries ?? null,
    timeout_ms: profile?.timeout_ms ?? null,
    readiness: profile?.readiness ?? null,
    // The declared values ignore any environment override. They are what the
    // drift assertion compares against, so an override cannot quietly become
    // the new frozen protocol.
    frozen_action_mode: profileActionMode ?? null,
    frozen_api_mode: profileApiMode ?? null,
    frozen_coordinate_mode: profile?.coordinate_mode ?? null,
    frozen_max_output_tokens: profile?.max_output_tokens ?? null,
    frozen_max_retries: profile?.max_retries ?? null,
    frozen_max_decision_retries: profile?.max_decision_retries ?? null
  };
}

/**
 * Fail-closed check used by the matched runners. Any environment override that
 * deviates from the frozen profile is reported as a drift finding and requires
 * an explicit PSS_ALLOW_PROTOCOL_OVERRIDE=1 opt-in, so a stale variable cannot
 * silently change the stratum.
 */
export function assertProtocolMatchesFrozenProfile({ env = process.env, provider, model, arm = 'visual' } = {}) {
  const protocol = resolveProviderProtocol({ env, provider, model, arm, strict: true });
  const allowOverride = env?.PSS_ALLOW_PROTOCOL_OVERRIDE === '1';
  const drift = [];
  const compare = (field, frozenKey) => {
    const frozenValue = protocol[frozenKey];
    if (frozenValue === null || frozenValue === undefined) return;
    if (String(protocol[field]) !== String(frozenValue)) {
      drift.push({ field, frozen: frozenValue, resolved: protocol[field], source: protocol[`${field}_source`] ?? 'unknown' });
    }
  };
  compare('action_mode', 'frozen_action_mode');
  compare('api_mode', 'frozen_api_mode');
  compare('coordinate_mode', 'frozen_coordinate_mode');
  compare('max_output_tokens', 'frozen_max_output_tokens');
  compare('max_retries', 'frozen_max_retries');
  compare('max_decision_retries', 'frozen_max_decision_retries');
  if (drift.length > 0 && !allowOverride) {
    throw new ProviderProfileViolationError(`Resolved protocol deviates from frozen profile ${protocol.profile_id}: ${JSON.stringify(drift)}. Set PSS_ALLOW_PROTOCOL_OVERRIDE=1 only for a declared, separately labelled ablation.`);
  }
  return { protocol, drift, override_allowed: allowOverride };
}

export function validateProviderProfileManifest(document = loadProviderProfileManifest()) {
  const errors = [];
  if (document?.schema_version !== '0.1') errors.push(`unsupported manifest schema_version: ${document?.schema_version}`);
  if (typeof document?.frozen_at !== 'string' || !document.frozen_at.trim()) errors.push('manifest frozen_at must be a non-empty string');
  const profiles = document?.profiles;
  if (!Array.isArray(profiles) || profiles.length === 0) {
    errors.push('manifest profiles must be a non-empty array');
    return { ok: false, errors, profile_count: 0 };
  }
  const seenIds = new Set();
  const seenProviderModel = new Set();
  for (const [index, profile] of profiles.entries()) {
    const where = `profiles[${index}]`;
    if (typeof profile?.profile_id !== 'string' || !/^[a-z0-9][a-z0-9.-]{2,127}$/.test(profile.profile_id)) errors.push(`${where}.profile_id is invalid`);
    else if (seenIds.has(profile.profile_id)) errors.push(`${where}.profile_id is duplicated: ${profile.profile_id}`);
    else seenIds.add(profile.profile_id);
    if (typeof profile?.provider_id !== 'string' || !profile.provider_id.trim()) errors.push(`${where}.provider_id must be a non-empty string`);
    if (typeof profile?.model_id !== 'string' || !profile.model_id.trim()) errors.push(`${where}.model_id must be a non-empty string`);
    const key = `${profile?.provider_id}::${profile?.model_id}`;
    if (seenProviderModel.has(key)) errors.push(`${where} duplicates provider/model pair: ${key}`);
    else seenProviderModel.add(key);
    if (!PROFILE_STATUSES.has(profile?.status)) errors.push(`${where}.status is invalid: ${profile?.status}`);
    if (!ACTION_MODES.has(profile?.action_mode)) errors.push(`${where}.action_mode must be tool or json`);
    if (!API_MODES.has(profile?.api_mode)) errors.push(`${where}.api_mode must be chat or responses`);
    for (const field of ['max_output_tokens', 'max_retries', 'max_decision_retries', 'timeout_ms']) {
      if (!Number.isInteger(profile?.[field]) || profile[field] < 0) errors.push(`${where}.${field} must be a non-negative integer`);
    }
    if (typeof profile?.optimization_profile !== 'string' || !profile.optimization_profile.trim()) errors.push(`${where}.optimization_profile must reference a profile in agent-optimization-profiles.v0.1.json`);
    if (!READINESS_STATUSES.has(profile?.readiness?.status)) errors.push(`${where}.readiness.status is invalid: ${profile?.readiness?.status}`);
    if (!profile?.env_overrides || typeof profile.env_overrides !== 'object') errors.push(`${where}.env_overrides must be an object`);
  }
  return { ok: errors.length === 0, errors, profile_count: profiles.length };
}
