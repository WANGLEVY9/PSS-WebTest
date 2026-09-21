#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const codeRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifestPath = path.join(codeRoot, 'config', 'benchmark-artifact-manifest.v1.0.json');
const containerName = process.env.PSS_WEBARENA_SHOPPING_CONTAINER ?? 'webarena-verified-shopping';
const siteUrl = process.env.PSS_WEBARENA_SHOPPING_URL ?? 'http://127.0.0.1:7770/';
const controllerUrl = process.env.PSS_WEBARENA_SHOPPING_CONTROLLER_URL ?? 'http://127.0.0.1:7771/status';
const dockerContext = process.env.PSS_WEBARENA_DOCKER_CONTEXT?.trim() || null;
const maxPolls = Number.parseInt(process.env.PSS_WEBARENA_HEALTH_MAX_POLLS ?? '24', 10);
const pollIntervalMs = Number.parseInt(process.env.PSS_WEBARENA_HEALTH_POLL_INTERVAL_MS ?? '5000', 10);

function defaultExecFile(command, args) {
  return childProcess.execFileSync(command, args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    timeout: Number.parseInt(process.env.PSS_WEBARENA_DOCKER_COMMAND_TIMEOUT_MS ?? '180000', 10)
  }).trim();
}

function dockerArgs(args) {
  return dockerContext ? ['--context', dockerContext, ...args] : args;
}

function normalizeArchitecture(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'x86_64' || normalized === 'x86-64' || normalized === 'x64') return 'amd64';
  if (normalized === 'aarch64') return 'arm64';
  return normalized;
}

async function responseSummary(response) {
  const body = await response.text();
  let json = null;
  try { json = JSON.parse(body); } catch { /* bounded status probe may be non-JSON */ }
  return { status: response.status, ok: response.ok, json };
}

function serviceReady(controllerProbe) {
  const services = controllerProbe?.json?.details?.value?.services ?? {};
  return controllerProbe?.status === 200 && controllerProbe?.json?.success === true
    && services['php-fpm'] !== 'FATAL';
}

export async function probeWebArenaShoppingGate({
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
  execFile = defaultExecFile,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
  container = containerName,
  site = siteUrl,
  controller = controllerUrl,
  healthPolls = maxPolls,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
} = {}) {
  const expectedImage = manifest.mandatory_core.find((item) => item.id === 'webarena-verified')?.environment?.candidate_image?.reference;
  if (!expectedImage) throw new Error('benchmark artifact manifest lacks a WebArena Shopping candidate image');
  const expectedDigest = expectedImage.split('@')[1];
  let containerImage = null;
  let inspectError = null;
  try { containerImage = execFile('docker', dockerArgs(['inspect', container, '--format', '{{.Image}}'])); } catch (error) { inspectError = String(error?.stderr ?? error?.message ?? error); }
  const image_matches = containerImage === expectedDigest;
  let hostArch = null;
  let imageArch = null;
  let architectureError = null;
  try { hostArch = execFile('docker', dockerArgs(['info', '--format', '{{.Architecture}}'])); } catch (error) { architectureError = String(error?.stderr ?? error?.message ?? error); }
  try { imageArch = execFile('docker', dockerArgs(['image', 'inspect', expectedImage, '--format', '{{.Architecture}}'])); } catch (error) { architectureError = [architectureError, String(error?.stderr ?? error?.message ?? error)].filter(Boolean).join('; '); }
  const normalizedHostArch = normalizeArchitecture(hostArch);
  const normalizedImageArch = normalizeArchitecture(imageArch);
  const architecture_compatible = /^(amd64|arm64)$/.test(normalizedHostArch) && /^(amd64|arm64)$/.test(normalizedImageArch)
    ? normalizedHostArch === normalizedImageArch
    : false;
  let controllerProbe = null;
  let siteProbe = null;
  let probeError = null;
  let polls = 0;
  for (let poll = 1; poll <= healthPolls; poll += 1) {
    polls = poll;
    try {
      controllerProbe = await responseSummary(await fetchImpl(controller, { signal: AbortSignal.timeout(10_000) }));
      siteProbe = await responseSummary(await fetchImpl(site, { signal: AbortSignal.timeout(10_000), redirect: 'manual' }));
      if (serviceReady(controllerProbe) && siteProbe?.status >= 200 && siteProbe?.status < 400) break;
    } catch (error) {
      probeError = String(error?.message ?? error);
    }
    if (poll < healthPolls) await sleep(pollIntervalMs);
  }
  const services = controllerProbe?.json?.details?.value?.services ?? {};
  const phpFpm = services['php-fpm'] ?? null;
  const controllerReady = serviceReady(controllerProbe);
  // A canonical WebArena deployment may redirect HTTP to its configured base URL;
  // any non-error status is a reachable site for this infrastructure gate.
  const siteReady = Boolean(siteProbe && siteProbe.status >= 200 && siteProbe.status < 400);
  const ready = image_matches && architecture_compatible && controllerReady && siteReady && phpFpm !== 'FATAL';
  return {
    schema_version: '1.0',
    kind: 'webarena-shopping-environment-gate',
    observed_at: now(),
    benchmark_id: 'webarena-verified',
    container,
    expected_image: expectedImage,
    observed_container_image: containerImage,
    image_matches,
    host_architecture: hostArch,
    image_architecture: imageArch,
    normalized_host_architecture: normalizedHostArch,
    normalized_image_architecture: normalizedImageArch,
    architecture_compatible,
    architecture_error: architectureError,
    controller: controllerProbe,
    site: siteProbe,
    health_polls: polls,
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
