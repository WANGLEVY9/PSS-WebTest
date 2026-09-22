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
const cycles = Number.parseInt(process.env.PSS_WEBARENA_SHOPPING_RESET_CYCLES ?? '3', 10);

function defaultExecFile(command, args) {
  return childProcess.execFileSync(command, args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    timeout: Number.parseInt(process.env.PSS_WEBARENA_DOCKER_COMMAND_TIMEOUT_MS ?? '180000', 10)
  }).trim();
}

function dockerArgs(args) {
  return dockerContext ? ['--context', dockerContext, ...args] : args;
}

async function probe(fetchImpl, url) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(15_000), redirect: 'manual' });
  const body = await response.text();
  let json = null;
  try { json = JSON.parse(body); } catch { /* the site is intentionally probed as HTTP only */ }
  return { status: response.status, ok: response.ok, json };
}

function isHealthy(controller, site) {
  const services = controller?.json?.details?.value?.services ?? {};
  const php = services['php-fpm'];
  return controller?.status === 200 && controller?.json?.success === true && php !== 'FATAL'
    && site?.status >= 200 && site?.status < 400;
}

export async function probeWebArenaShoppingResetGate({
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
  execFile = defaultExecFile,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
  container = containerName,
  site = siteUrl,
  controller = controllerUrl,
  resetCycles = cycles,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  maxPolls = 24
} = {}) {
  const expectedImage = manifest.mandatory_core.find((item) => item.id === 'webarena-verified')?.environment?.candidate_image?.reference;
  if (!expectedImage) throw new Error('benchmark artifact manifest lacks a WebArena Shopping candidate image');
  const cycleResults = [];
  for (let cycle = 1; cycle <= resetCycles; cycle += 1) {
    let restartError = null;
    try { execFile('docker', dockerArgs(['restart', container])); } catch (error) { restartError = String(error?.stderr ?? error?.message ?? error); }
    let controllerProbe = null;
    let siteProbe = null;
    let recovered = false;
    let lastProbeError = null;
    for (let poll = 1; poll <= maxPolls && !recovered; poll += 1) {
      try {
        controllerProbe = await probe(fetchImpl, controller);
        siteProbe = await probe(fetchImpl, site);
        recovered = !restartError && isHealthy(controllerProbe, siteProbe);
      } catch (error) {
        lastProbeError = String(error?.message ?? error);
      }
      if (!recovered && poll < maxPolls) await sleep(5_000);
    }
    cycleResults.push({ cycle, recovered, restart_error: restartError, probe_error: lastProbeError, controller: controllerProbe, site: siteProbe });
  }
  const ready = Number.isInteger(resetCycles) && resetCycles >= 3 && cycleResults.length === resetCycles
    && cycleResults.every((result) => result.recovered);
  return {
    schema_version: '1.0',
    kind: 'webarena-shopping-reset-recovery-gate',
    observed_at: now(),
    benchmark_id: 'webarena-verified',
    container,
    expected_image: expectedImage,
    reset_cycles: resetCycles,
    cycle_results: cycleResults,
    ready,
    classification: ready ? 'reset-recovery-ready' : 'infrastructure-gate-failed',
    // A container/service restart is a recovery probe. It is not evidence that
    // task-level database state has been reset; that remains a separate adapter
    // contract requirement before confirmatory execution.
    state_reset_verified: false,
    study_execution_allowed: false
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = await probeWebArenaShoppingResetGate();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 2;
}
