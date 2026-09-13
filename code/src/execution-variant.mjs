/**
 * Stable reporting stratum for framework/protocol changes that must not be
 * pooled into a model-only effect. Playwright is the scripted anchor; agent
 * runners are separated by framework and provider-format protocol variant.
 */
export function executionVariant(record) {
  const runner = String(record.provenance?.runner_version ?? 'unknown');
  if (record.arm === 'playwright') return record.provenance?.framework_id ?? 'playwright';
  const framework = record.provenance?.framework_id
    ?? (runner.includes('stagehand') ? 'stagehand' : runner.includes('browser-use') ? 'browser-use' : 'pss-native');
  const protocolVariant = runner.includes('bounded-json-repair') ? 'bounded-json-repair' : 'strict-provider-format';
  return `${framework}:${protocolVariant}`;
}
