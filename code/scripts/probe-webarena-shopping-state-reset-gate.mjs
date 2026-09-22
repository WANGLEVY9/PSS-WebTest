#!/usr/bin/env node
import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const codeRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const manifestPath = path.join(codeRoot, 'config', 'benchmark-artifact-manifest.v1.0.json');
const containerName = process.env.PSS_WEBARENA_SHOPPING_CONTAINER ?? 'webarena-verified-shopping-x86';
const siteUrl = process.env.PSS_WEBARENA_SHOPPING_URL ?? 'http://127.0.0.1:7770/';
const controllerUrl = process.env.PSS_WEBARENA_SHOPPING_CONTROLLER_URL ?? 'http://127.0.0.1:7771/status';
const dockerContext = process.env.PSS_WEBARENA_DOCKER_CONTEXT?.trim() || null;
const cycles = Number.parseInt(process.env.PSS_WEBARENA_SHOPPING_STATE_RESET_CYCLES ?? '3', 10);
// Magento populates scheduler/message-queue rows while services boot. These
// are runtime bookkeeping, not user-visible task state, and are excluded only
// after the fresh-image diff identified them explicitly.
const volatileTables = new Set(['cron_schedule', 'queue_message', 'queue_message_status']);

function defaultExecFile(command, args) {
  return childProcess.execFileSync(command, args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    timeout: Number.parseInt(process.env.PSS_WEBARENA_DOCKER_COMMAND_TIMEOUT_MS ?? '180000', 10)
  }).trim();
}

function dockerArgs(args) {
  return dockerContext ? ['--context', dockerContext, ...args] : args;
}

function digest(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

async function probe(fetchImpl, url) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(15_000), redirect: 'manual' });
  const body = await response.text();
  let json = null;
  try { json = JSON.parse(body); } catch { /* the storefront is probed as HTTP only */ }
  return { status: response.status, ok: response.ok, json };
}

function healthy(controller, site) {
  const services = controller?.json?.details?.value?.services ?? {};
  return controller?.status === 200 && controller?.json?.success === true
    && services['php-fpm'] !== 'FATAL' && site?.status >= 200 && site?.status < 400;
}

async function waitUntilHealthy(fetchImpl, site, controller, sleep, maxPolls = 24) {
  let controllerProbe = null;
  let siteProbe = null;
  let probeError = null;
  for (let poll = 1; poll <= maxPolls; poll += 1) {
    try {
      controllerProbe = await probe(fetchImpl, controller);
      siteProbe = await probe(fetchImpl, site);
      if (healthy(controllerProbe, siteProbe)) return { recovered: true, controller: controllerProbe, site: siteProbe, probe_error: probeError };
    } catch (error) {
      probeError = String(error?.message ?? error);
    }
    if (poll < maxPolls) await sleep(5_000);
  }
  return { recovered: false, controller: controllerProbe, site: siteProbe, probe_error: probeError };
}

function parseMounts(value) {
  try { return JSON.parse(value || '[]'); } catch { return null; }
}

function captureState(execFile, container) {
  const mountsRaw = execFile('docker', dockerArgs(['inspect', container, '--format', '{{json .Mounts}}']));
  const imageId = execFile('docker', dockerArgs(['inspect', container, '--format', '{{.Image}}']));
  const dbCardinality = execFile('docker', dockerArgs(['exec', container, 'sh', '-c',
    "mysql -N -B -umagentouser -pMyPassword -e \"SELECT table_name,table_rows FROM information_schema.tables WHERE table_schema='magentodb' AND table_name NOT IN ('cron_schedule','queue_message','queue_message_status') ORDER BY table_name\"" ]));
  const schema = execFile('docker', dockerArgs(['exec', container, 'sh', '-c',
    'mysqldump -umagentouser -pMyPassword --no-data --skip-comments --compact magentodb 2>/dev/null | sed -E "s/AUTO_INCREMENT=[0-9]+/AUTO_INCREMENT=0/g"']));
  const state = {
    image_id: imageId,
    mounts: parseMounts(mountsRaw),
    database_cardinality_digest: digest(dbCardinality),
    schema_digest: digest(schema),
    state_scope: 'mariadb-application-cardinality-and-schema-v1',
    volatile_tables_excluded: [...volatileTables]
  };
  return { ...state, state_digest: digest(JSON.stringify(state)) };
}

export async function probeWebArenaShoppingStateResetGate({
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
  execFile = defaultExecFile,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString(),
  container = containerName,
  site = siteUrl,
  controller = controllerUrl,
  resetCycles = cycles,
  allowRecreate = process.env.PSS_WEBARENA_ALLOW_RECREATE === '1',
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  maxPolls = 24
} = {}) {
  const expectedImage = manifest.mandatory_core.find((item) => item.id === 'webarena-verified')?.environment?.candidate_image?.reference;
  if (!expectedImage) throw new Error('benchmark artifact manifest lacks a WebArena Shopping candidate image');
  if (!allowRecreate) {
    return {
      schema_version: '1.0', kind: 'webarena-shopping-state-reset-gate', observed_at: now(),
      benchmark_id: 'webarena-verified', container, reset_cycles: resetCycles,
      ready: false, classification: 'recreate-not-authorized', state_reset_verified: false,
      study_execution_allowed: false
    };
  }
  const cycleResults = [];
  for (let cycle = 1; cycle <= resetCycles; cycle += 1) {
    let removeError = null;
    let runError = null;
    try { execFile('docker', dockerArgs(['rm', '-f', container])); } catch (error) { removeError = String(error?.stderr ?? error?.message ?? error); }
    try {
      execFile('docker', dockerArgs(['run', '-d', '--name', container, '--platform', 'linux/amd64', '-p', '7770:80', '-p', '7771:8877', expectedImage]));
    } catch (error) { runError = String(error?.stderr ?? error?.message ?? error); }
    const recovery = runError ? { recovered: false, controller: null, site: null, probe_error: null }
      : await waitUntilHealthy(fetchImpl, site, controller, sleep, maxPolls);
    let state = null;
    let stateError = null;
    if (recovery.recovered) {
      try { state = captureState(execFile, container); } catch (error) { stateError = String(error?.stderr ?? error?.message ?? error); }
    }
    cycleResults.push({ cycle, recovered: recovery.recovered, remove_error: removeError, run_error: runError,
      probe_error: recovery.probe_error, state_error: stateError, controller: recovery.controller,
      site: recovery.site, state });
  }
  const states = cycleResults.map((cycle) => cycle.state?.state_digest).filter(Boolean);
  const imageMatches = cycleResults.every((cycle) => cycle.state?.image_id === expectedImage.split('@')[1]);
  const noPersistentMounts = cycleResults.every((cycle) => Array.isArray(cycle.state?.mounts) && cycle.state.mounts.length === 0);
  const stateStable = states.length === resetCycles && new Set(states).size === 1;
  const ready = Number.isInteger(resetCycles) && resetCycles >= 3 && cycleResults.every((cycle) => cycle.recovered && !cycle.state_error)
    && imageMatches && noPersistentMounts && stateStable;
  return {
    schema_version: '1.0', kind: 'webarena-shopping-state-reset-gate', observed_at: now(),
    benchmark_id: 'webarena-verified', container, expected_image: expectedImage,
    reset_cycles: resetCycles, cycle_results: cycleResults, image_matches: imageMatches,
    no_persistent_mounts: noPersistentMounts, state_digest_stable: stateStable,
    baseline_state_digest: stateStable ? states[0] : null,
    // Cardinality/schema repeatability cannot detect changed values in existing rows.
    // Preserve the observation, but never promote it to verified task-state reset.
    ready: false, classification: ready ? 'cardinality-repeatability-only' : 'infrastructure-gate-failed',
    cardinality_repeatability_verified: ready,
    state_reset_verified: false, study_execution_allowed: false,
    missing_evidence: ['controlled task-state mutation', 'restored row-content fingerprint', 'unmodified neighboring instance']
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = await probeWebArenaShoppingStateResetGate();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready) process.exitCode = 2;
}
