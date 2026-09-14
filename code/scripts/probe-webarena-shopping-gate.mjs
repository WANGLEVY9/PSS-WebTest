#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const manifestPath = path.join(codeRoot, 'config', 'benchmark-artifact-manifest.v1.0.json');
const containerName = process.env.PSS_WEBARENA_SHOPPING_CONTAINER ?? 'webarena-verified-shopping';
const siteUrl = process.env.PSS_WEBARENA_SHOPPING_URL ?? 'http://127.0.0.1:7770/';
const controllerUrl = process.env.PSS_WEBARENA_SHOPPING_CONTROLLER_URL ?? 'http://127.0.0.1:7771/status';

function defaultExecFile(command, args) {
  return childProcess.execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

async function responseSummary(response) {
  const body = await response.text();
  let json = null;
  try { json = JSON.parse(body); } catch { /* bounded status probe may be non-JSON */ }
  return { status: response.status, ok: response.ok, json };
}

export async function probeWebArenaShoppingGate({
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
  execFile = defaultExecFile,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
  container = containerName,
  site = siteUrl,
  controller = controllerUrl
} = {}) {
  const expectedImage = manifest.mandatory_core.find((item) => item.id === 'webarena-verified')?.environment?.candidate_image?.reference;
  if (!expectedImage) throw new Error('benchmark artifact manifest lacks a WebArena Shopping candidate image');
  const expectedDigest = expectedImage.split('@')[1];
  let containerImage = null;
  let inspectError = null;
  try { containerImage = execFile('docker', ['inspect', container, '--format', '{{.Image}}']); } catch (error) { inspectError = String(error?.stderr ?? error?.message ?? error); }
  const image_matches = containerImage === expectedDigest;
  let controllerProbe = null;
  let siteProbe = null;
  let probeError = null;
  try {
    controllerProbe = await responseSummary(await fetchImpl(controller, { signal: AbortSignal.timeout(10_000) }));
    siteProbe = await responseSummary(await fetchImpl(site, { signal: AbortSignal.timeout(10_000), redirect: 'manual' }));
  } catch (error) {
    probeError = String(error?.message ?? error);
  }
  const services = controllerProbe?.json?.details?.value?.services ?? {};
  const phpFpm = services['php-fpm'] ?? null;
  const controllerReady = controllerProbe?.json?.success === true;
  const siteReady = Boolean(siteProbe?.ok && siteProbe.status >= 200 && siteProbe.status < 400);
  const ready = image_matches && controllerReady && siteReady && phpFpm !== 'FATAL';
  return {
    schema_version: '1.0',
    kind: 'webarena-shopping-environment-gate',
    observed_at: now(),
    benchmark_id: 'webarena-verified',
    container,
    expected_image: expectedImage,
    observed_container_image: containerImage,
    image_matches,
    controller: controllerProbe,
    site: siteProbe,
    php_fpm_service: phpFpm,
    inspect_error: inspectError,
    probe_error: probeError,
    ready,
    classification: ready ? 'environment-ready' : 'infrastructure-gate-failed',
    study_execution_allowed: false
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = await probeWebArenaShoppingGate();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 2;
}
