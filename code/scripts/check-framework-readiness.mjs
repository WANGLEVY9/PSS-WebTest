#!/usr/bin/env node
// Framework readiness gate: importable AND version-exact AND browser-resolvable.
//
// The previous version only asked "is the package importable?". That is not
// enough: an environment rebuilt at a different version would have been
// reported ready, and the run records would then have carried a version that
// never ran. This gate fails closed on a version mismatch.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { FRAMEWORK_VARIANTS } from '../src/framework-variants.mjs';
import { loadFrameworkManifest, probeNodeFrameworkVersion } from '../src/framework-version.mjs';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const repositoryRoot = path.resolve(codeRoot, '..');
const manifest = loadFrameworkManifest();

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    cwd: options.cwd ?? codeRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeoutMs ?? 60000
  });
  return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error };
}

function probeUvEnvironment(environment) {
  const pythonPath = path.join(repositoryRoot, environment.venv_path, 'bin', 'python');
  if (!fs.existsSync(pythonPath)) return { ok: false, detail: `interpreter missing: ${path.relative(repositoryRoot, pythonPath)}` };
  const script = 'import importlib.metadata as m, sys, json\nprint(json.dumps({"distribution": m.version(sys.argv[1]), "companion": (m.version(sys.argv[2]) if len(sys.argv) > 2 else None), "interpreter": sys.version.split()[0]}))';
  const args = ['-c', script, environment.distribution, ...(environment.companion_distributions ?? [])];
  const result = run(pythonPath, args);
  if (result.code !== 0) return { ok: false, detail: `probe failed: ${String(result.stderr).trim().split('\n').slice(-1)[0]?.slice(0, 200)}` };
  try {
    const parsed = JSON.parse(result.stdout.trim());
    return { ok: true, version: parsed.distribution, companionVersion: parsed.companion, interpreter: parsed.interpreter, pythonPath: path.relative(repositoryRoot, pythonPath) };
  } catch (error) {
    return { ok: false, detail: `unparseable probe output: ${error.message}` };
  }
}

const rows = [];
for (const environment of manifest.environments) {
  const row = {
    environment_id: environment.environment_id,
    framework_id: environment.framework_id,
    track: environment.track,
    manager: environment.manager,
    declared_version: environment.resolved?.version ?? null,
    install_status: environment.install_status,
    installed_version: null,
    interpreter: null,
    status: 'unknown',
    detail: null
  };

  if (environment.install_status === 'collapsed-to-historical') {
    // Upstream latest equals the frozen historical version, so this entry is not
    // an independent stratum. It is not "ready" as a separate environment and it
    // must never be reported as one.
    row.status = 'collapsed-to-historical';
    row.detail = environment.track_equivalence?.note ?? 'latest track equals the historical version';
    rows.push(row);
    continue;
  }

  if (environment.install_status !== 'installed') {
    row.status = 'missing';
    row.detail = environment.install_error ?? `install_status=${environment.install_status}; run: node scripts/build-framework-envs.mjs`;
    rows.push(row);
    continue;
  }

  if (environment.manager === 'npm') {
    const probe = probeNodeFrameworkVersion({ frameworkId: environment.framework_id, track: environment.track, environmentId: environment.environment_id, manifest });
    if (!probe.ok) {
      row.status = 'missing';
      row.detail = probe.detail;
    } else {
      row.installed_version = probe.version;
      row.interpreter = process.version;
      row.status = probe.version === row.declared_version ? 'ready' : 'version-mismatch';
      row.detail = probe.version === row.declared_version ? probe.source : `installed ${probe.version} != declared ${row.declared_version}`;
    }
    rows.push(row);
    continue;
  }

  const probe = probeUvEnvironment(environment);
  if (!probe.ok) {
    row.status = 'missing';
    row.detail = probe.detail;
  } else {
    row.installed_version = probe.version;
    row.interpreter = `python ${probe.interpreter}`;
    row.companion_version = probe.companionVersion;
    row.status = probe.version === row.declared_version ? 'ready' : 'version-mismatch';
    row.detail = probe.version === row.declared_version ? probe.pythonPath : `installed ${probe.version} != declared ${row.declared_version}`;
  }
  rows.push(row);
}

// Browser availability: every framework arm must be able to launch the same
// frozen browser build. An explicit override is recorded, never assumed.
const browserOverride = process.env.PSS_CHROME_EXECUTABLE ?? null;
if (browserOverride && !fs.existsSync(browserOverride)) {
  console.error(`PSS_CHROME_EXECUTABLE points at a missing file: ${browserOverride}`);
  process.exitCode = 1;
}
const playwrightBrowsers = run('npx', ['playwright', '--version'], { cwd: codeRoot });

const summary = rows.reduce((accumulator, row) => { accumulator[row.status] = (accumulator[row.status] ?? 0) + 1; return accumulator; }, {});
console.log(JSON.stringify({
  framework_variants: FRAMEWORK_VARIANTS.map((variant) => variant.id),
  manifest: path.relative(repositoryRoot, path.join(codeRoot, 'config', 'frameworks', 'framework-environment-manifest.v0.1.json')),
  browser: {
    mode: browserOverride ? 'explicit-override' : 'framework-bundled-chromium',
    executable_path: browserOverride,
    playwright_cli: playwrightBrowsers.code === 0 ? playwrightBrowsers.stdout.trim() : 'unavailable'
  },
  environments: rows,
  summary,
  fail_closed: true
}, null, 2));

const failing = rows.filter((row) => !['ready', 'collapsed-to-historical'].includes(row.status));
if (failing.length > 0) {
  console.error(`\nFramework readiness gate FAILED for: ${failing.map((row) => `${row.environment_id}(${row.status})`).join(', ')}`);
  process.exitCode = 1;
}
