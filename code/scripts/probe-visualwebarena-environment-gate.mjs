#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const manifestPath = path.join(codeRoot, 'config', 'benchmark-artifact-manifest.v1.0.json');
const defaultServices = {
  classifieds: process.env.PSS_VWA_CLASSIFIEDS_URL ?? 'http://127.0.0.1:9980/',
  shopping: process.env.PSS_VWA_SHOPPING_URL ?? 'http://127.0.0.1:7770/',
  reddit: process.env.PSS_VWA_REDDIT_URL ?? 'http://127.0.0.1:9999/',
  homepage: process.env.PSS_VWA_HOMEPAGE_URL ?? 'http://127.0.0.1:4399/'
};

async function probe(fetchImpl, url) {
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000), redirect: 'manual' });
    return { url, status: response.status, ok: response.ok };
  } catch (error) {
    return { url, status: null, ok: false, error: String(error?.message ?? error) };
  }
}

export async function probeVisualWebArenaEnvironmentGate({
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
  services = defaultServices,
  classifiedsResetToken = process.env.PSS_VWA_CLASSIFIEDS_RESET_TOKEN ?? ''
} = {}) {
  const benchmark = manifest.mandatory_core.find((item) => item.id === 'visualwebarena');
  if (!benchmark) throw new Error('benchmark artifact manifest lacks VisualWebArena');
  const serviceProbes = Object.fromEntries(await Promise.all(Object.entries(services).map(async ([name, url]) => [name, await probe(fetchImpl, url)])));
  const healthy = Object.values(serviceProbes).every((result) => result.ok && result.status >= 200 && result.status < 400);
  const resetTokenConfigured = typeof classifiedsResetToken === 'string' && classifiedsResetToken.trim().length >= 8;
  const ready = healthy && resetTokenConfigured;
  return {
    schema_version: '1.0',
    kind: 'visualwebarena-environment-gate',
    observed_at: now(),
    benchmark_id: 'visualwebarena',
    pinned_source_commit: benchmark.source_commit,
    services: serviceProbes,
    classifieds_reset_token_configured: resetTokenConfigured,
    ready,
    classification: ready ? 'environment-ready' : 'infrastructure-gate-failed',
    study_execution_allowed: false
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = await probeVisualWebArenaEnvironmentGate();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 2;
}
