#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
// Build the isolated external-framework environments declared in
// config/frameworks/framework-environment-manifest.v0.1.json.
//
// Why this exists: the 2026-09-09 smoke evidence pointed at
// /private/tmp/pss-frameworks/*, which the OS cleaned up, and no dependency
// lock existed anywhere in the repository. Environments are now created in the
// gitignored third_party/frameworks/ tree while the manifest and lock files stay
// tracked, so a clone can rebuild them with one command.
//
// Every environment is fail-closed: a failed install is recorded as
// install_status "failed" with the error, and the readiness gate will refuse to
// run that stratum.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const codeRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const repositoryRoot = path.resolve(codeRoot, '..');
const manifestPath = path.join(codeRoot, 'config', 'frameworks', 'framework-environment-manifest.v0.1.json');

const args = process.argv.slice(2);
const onlyTrack = args.includes('--track') ? args[args.indexOf('--track') + 1] : null;
const onlyEnvironment = args.includes('--env') ? args[args.indexOf('--env') + 1] : null;
const force = args.includes('--force');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    encoding: 'utf8',
    cwd: options.cwd ?? codeRoot,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: options.timeoutMs ?? 900000
  });
  return { code: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error };
}

function tail(text, lines = 6) {
  return String(text ?? '').trim().split(/\r?\n/).slice(-lines).join(' | ').slice(0, 600);
}

function venvPython(relativeVenvPath) {
  return path.join(repositoryRoot, relativeVenvPath, 'bin', 'python');
}

function probePython(pythonPath, module) {
  const result = run(pythonPath, ['-c', `import importlib.metadata as m, sys\nprint(m.version(${JSON.stringify(module)}))\nprint(sys.version.split()[0])`]);
  if (result.code !== 0) return { ok: false, detail: tail(result.stderr || result.stdout) };
  const [version, interpreter] = result.stdout.trim().split(/\r?\n/);
  return { ok: true, version, interpreter };
}

function probeNode(nodeRoot, packageName) {
  const resolved = path.join(repositoryRoot, nodeRoot, 'node_modules', packageName, 'package.json');
  if (!fs.existsSync(resolved)) return { ok: false, detail: `not found: ${path.relative(repositoryRoot, resolved)}` };
  const document = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const node = run('node', ['--version'], { cwd: repositoryRoot });
  return { ok: true, version: document.version, interpreter: node.stdout.trim() };
}

function installUv(environment) {
  const venvPath = path.join(repositoryRoot, environment.venv_path);
  const pythonPath = venvPython(environment.venv_path);
  if (force && fs.existsSync(venvPath)) fs.rmSync(venvPath, { recursive: true, force: true });
  if (!fs.existsSync(pythonPath)) {
    const created = run('uv', ['venv', environment.venv_path, '--python', environment.python], { cwd: repositoryRoot });
    if (created.code !== 0) return { ok: false, detail: `uv venv failed: ${tail(created.stderr)}` };
  }
  const installed = run('uv', ['pip', 'install', '--python', pythonPath, ...environment.packages], { cwd: repositoryRoot });
  if (installed.code !== 0) return { ok: false, detail: `uv pip install failed: ${tail(installed.stderr)}` };
  const frozen = run('uv', ['pip', 'freeze', '--python', pythonPath], { cwd: repositoryRoot });
  if (frozen.code === 0) {
    const lockPath = path.join(repositoryRoot, environment.lock_file);
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, frozen.stdout);
  }
  const probe = probePython(pythonPath, environment.distribution);
  if (!probe.ok) return { ok: false, detail: `import probe failed: ${probe.detail}` };
  const companions = {};
  for (const companion of environment.companion_distributions ?? []) {
    const companionProbe = probePython(pythonPath, companion);
    companions[companion] = companionProbe.ok ? companionProbe.version : null;
    if (!companionProbe.ok) return { ok: false, detail: `companion import probe failed for ${companion}: ${companionProbe.detail}` };
  }
  return { ok: true, resolved: { distribution: environment.distribution, version: probe.version, interpreter: probe.interpreter, python_path: path.relative(repositoryRoot, pythonPath), companions } };
}

function installNpm(environment) {
  const nodeRoot = path.join(repositoryRoot, environment.node_root);
  if (environment.node_root === 'code') {
    // The historical Stagehand layer is the existing code/ install, pinned by
    // code/package-lock.json. Do not reinstall it here.
    const probe = probeNode(environment.node_root, environment.distribution);
    if (!probe.ok) return { ok: false, detail: probe.detail };
    return { ok: true, resolved: { distribution: environment.distribution, version: probe.version, interpreter: probe.interpreter, node_root: environment.node_root } };
  }
  fs.mkdirSync(nodeRoot, { recursive: true });
  const packageJsonPath = path.join(nodeRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    fs.writeFileSync(packageJsonPath, `${JSON.stringify({ name: 'pss-framework-env', private: true, version: '0.0.0' }, null, 2)}\n`);
  }
  const installed = run('npm', ['install', '--no-audit', '--no-fund', ...environment.packages], { cwd: nodeRoot });
  if (installed.code !== 0) return { ok: false, detail: `npm install failed: ${tail(installed.stderr)}` };
  const lockSource = path.join(nodeRoot, 'package-lock.json');
  if (fs.existsSync(lockSource)) {
    const lockTarget = path.join(repositoryRoot, environment.lock_file);
    fs.mkdirSync(path.dirname(lockTarget), { recursive: true });
    fs.copyFileSync(lockSource, lockTarget);
  }
  const probe = probeNode(environment.node_root, environment.distribution);
  if (!probe.ok) return { ok: false, detail: probe.detail };
  return { ok: true, resolved: { distribution: environment.distribution, version: probe.version, interpreter: probe.interpreter, node_root: environment.node_root } };
}

const selected = manifest.environments
  .filter((environment) => !onlyTrack || environment.track === onlyTrack)
  .filter((environment) => !onlyEnvironment || environment.environment_id === onlyEnvironment);

if (selected.length === 0) {
  console.error('No environment matched the requested filter.');
  process.exitCode = 2;
} else {
  for (const environment of selected) {
    process.stdout.write(`[${environment.environment_id}] ${environment.manager} ${environment.packages.join(' ')} ... `);
    const result = environment.manager === 'uv' ? installUv(environment) : installNpm(environment);
    if (result.ok) {
      environment.install_status = 'installed';
      environment.resolved = { ...result.resolved, resolved_at: new Date().toISOString() };
      environment.install_error = null;
      console.log(`installed ${result.resolved.version}${result.resolved.interpreter ? ` (python/node ${result.resolved.interpreter})` : ''}`);
    } else {
      environment.install_status = 'failed';
      environment.resolved = null;
      environment.install_error = result.detail;
      console.log(`FAILED: ${result.detail}`);
    }
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const summary = manifest.environments.map((environment) => ({
    environment_id: environment.environment_id,
    track: environment.track,
    framework_id: environment.framework_id,
    install_status: environment.install_status,
    resolved_version: environment.resolved?.version ?? null
  }));
  console.log(`\n${JSON.stringify({ manifest: path.relative(repositoryRoot, manifestPath), environments: summary }, null, 2)}`);
  if (summary.some((entry) => entry.install_status === 'failed')) process.exitCode = 1;
}
