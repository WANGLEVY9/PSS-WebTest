#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const manifestPath = path.join(codeRoot, 'config', 'benchmark-artifact-manifest.v1.0.json');
const defaultServices = {
  classifieds: process.env.PSS_ATA_CLASSIFIEDS_URL ?? 'http://www.vtaas-benchmark.com:9980/',
  shopping: process.env.PSS_ATA_SHOPPING_URL ?? 'http://www.vtaas-benchmark.com:7770/',
  postmill: process.env.PSS_ATA_POSTMILL_URL ?? 'http://www.vtaas-benchmark.com:9999/'
};

async function probe(fetchImpl, url) {
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(10_000), redirect: 'manual' });
    const reachable = response.status >= 200 && response.status < 400;
    return { url, status: response.status, ok: response.ok, reachable };
  } catch (error) {
    return { url, status: null, ok: false, reachable: false, error: String(error?.message ?? error) };
  }
}

export async function probeAtaEnvironmentGate({
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
  services = defaultServices,
  githubToken = process.env.PSS_ATA_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? ''
} = {}) {
  const benchmark = manifest.mandatory_core.find((item) => item.id === 'autonomous-tester-agent-benchmark');
  if (!benchmark) throw new Error('benchmark artifact manifest lacks ATA/PinATA');
  const serviceProbes = Object.fromEntries(await Promise.all(Object.entries(services).map(async ([name, url]) => [name, await probe(fetchImpl, url)])));
  const servicesReachable = Object.values(serviceProbes).every((result) => result.reachable);
  const resetCredentialConfigured = typeof githubToken === 'string' && githubToken.trim().length >= 8;
  // The published evaluator currently dispatches a GitHub Actions workflow and
  // consumes the Actor/Assertor LLM status. Until an independent, unchanged
  // PASS/FAIL oracle is audited, the benchmark cannot be admitted even if the
  // remote applications happen to be reachable.
  const evaluatorIndependenceVerified = false;
  const ready = servicesReachable && resetCredentialConfigured && evaluatorIndependenceVerified;
  return {
    schema_version: '1.0',
    kind: 'ata-environment-gate',
    observed_at: now(),
    benchmark_id: 'autonomous-tester-agent-benchmark',
    pinned_source_commit: benchmark.source_commit,
    services: serviceProbes,
    services_reachable: servicesReachable,
    reset_credential_configured: resetCredentialConfigured,
    evaluator_independence_verified: evaluatorIndependenceVerified,
    ready,
    classification: ready ? 'environment-ready'
      : ((!servicesReachable || !resetCredentialConfigured) ? 'infrastructure-gate-failed' : 'evaluator-semantics-pending'),
    study_execution_allowed: false
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = await probeAtaEnvironmentGate();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 2;
}
