import fs from 'node:fs';
import path from 'node:path';

/**
 * Runtime framework-version truth.
 *
 * The defect this module fixes: `framework_version` used to be a string literal
 * in five places (two Python runners, two JS runners and the configuration
 * registry). Because the registry and the record both held the same literal,
 * `validateRunRecordAgainstRegistry()` could never fail, so a rebuilt
 * environment would silently report the old version in every run record.
 *
 * Here the declared version comes from the environment manifest, the installed
 * version comes from the actual distribution, and a mismatch fails closed.
 */

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const repositoryRoot = path.resolve(codeRoot, '..');
export const frameworkManifestPath = path.join(codeRoot, 'config', 'frameworks', 'framework-environment-manifest.v0.1.json');

export class FrameworkVersionMismatchError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FrameworkVersionMismatchError';
  }
}

export class FrameworkEnvironmentMissingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FrameworkEnvironmentMissingError';
  }
}

export function loadFrameworkManifest({ manifestPath = frameworkManifestPath } = {}) {
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

export function findFrameworkEnvironment({ frameworkId, track = 'historical', environmentId = null, manifest = loadFrameworkManifest() }) {
  const candidates = (manifest.environments ?? []).filter((environment) => environment.framework_id === frameworkId);
  if (environmentId) return candidates.find((environment) => environment.environment_id === environmentId) ?? null;
  return candidates.find((environment) => environment.track === track) ?? null;
}

/**
 * Read the installed version of an npm-managed framework from its package.json.
 * Python-managed frameworks cannot be probed from Node without spawning the
 * interpreter, so their adapters report the version themselves and this module
 * only validates it (see assertFrameworkVersion).
 */
export function probeNodeFrameworkVersion({ frameworkId, track = 'historical', environmentId = null, manifest } = {}) {
  const environment = findFrameworkEnvironment({ frameworkId, track, environmentId, manifest: manifest ?? loadFrameworkManifest() });
  if (!environment) return { ok: false, detail: `no manifest environment for framework ${frameworkId} track ${track}` };
  if (environment.manager !== 'npm') return { ok: false, detail: `environment ${environment.environment_id} is not npm-managed` };
  const nodeRoot = path.join(repositoryRoot, environment.node_root);
  const packageJson = path.join(nodeRoot, 'node_modules', environment.distribution, 'package.json');
  if (!fs.existsSync(packageJson)) return { ok: false, detail: `installed package not found: ${path.relative(repositoryRoot, packageJson)}` };
  return { ok: true, version: JSON.parse(fs.readFileSync(packageJson, 'utf8')).version, source: path.relative(repositoryRoot, packageJson) };
}

export function resolveFrameworkVersion({ frameworkId, track = 'historical', environmentId = null, installed = null, installedFrom = null, manifest } = {}) {
  const document = manifest ?? loadFrameworkManifest();
  const environment = findFrameworkEnvironment({ frameworkId, track, environmentId, manifest: document });
  if (!environment) {
    throw new FrameworkEnvironmentMissingError(`No framework environment is declared for ${frameworkId} (track ${track}) in ${path.basename(frameworkManifestPath)}`);
  }
  const declared = environment.resolved?.version ?? null;
  const installedVersion = installed ?? null;
  return {
    framework_id: frameworkId,
    environment_id: environment.environment_id,
    track: environment.track,
    manager: environment.manager,
    declared_version: declared,
    installed_version: installedVersion,
    installed_from: installedFrom,
    match: declared !== null && installedVersion !== null && declared === installedVersion,
    install_status: environment.install_status,
    track_equivalence: environment.track_equivalence ?? null
  };
}

/**
 * Fail-closed assertion used by every framework runner before it writes a run
 * record. A version mismatch must never reach the ledger: the record would
 * claim a version that did not run.
 */
export function assertFrameworkVersion({ frameworkId, track = 'historical', installed, installedFrom = null, manifest } = {}) {
  const resolved = resolveFrameworkVersion({ frameworkId, track, installed, installedFrom, manifest });
  if (resolved.install_status !== 'installed') {
    throw new FrameworkEnvironmentMissingError(`Framework environment ${resolved.environment_id} is "${resolved.install_status}", not installed`);
  }
  if (installed === null || installed === undefined) {
    throw new FrameworkVersionMismatchError(`No installed version was reported for ${frameworkId} (${resolved.environment_id}); refusing to write a record that would guess the version`);
  }
  if (!resolved.match) {
    throw new FrameworkVersionMismatchError(`Installed ${frameworkId} version ${installed} does not match the manifest declaration ${resolved.declared_version} for ${resolved.environment_id}`);
  }
  return resolved;
}

/**
 * The registry declares the version a configuration expects. This cross-check
 * makes `validateRunRecordAgainstRegistry()` meaningful: it can only pass if
 * the registry, the manifest and the installed distribution all agree.
 */
export function assertRegistryAgreesWithManifest({ registryFrameworkId, registryVersion, frameworkId, track = 'historical', manifest } = {}) {
  const document = manifest ?? loadFrameworkManifest();
  const environment = findFrameworkEnvironment({ frameworkId, track, manifest: document });
  if (!environment) throw new FrameworkEnvironmentMissingError(`No manifest environment for ${frameworkId} (track ${track})`);
  const declared = environment.resolved?.version ?? null;
  if (declared === null) throw new FrameworkVersionMismatchError(`Manifest environment ${environment.environment_id} has no resolved version`);
  if (registryVersion !== declared) {
    throw new FrameworkVersionMismatchError(`Registry framework ${registryFrameworkId} declares version ${registryVersion} but the manifest declares ${declared} for ${environment.environment_id}`);
  }
  return { framework_id: frameworkId, environment_id: environment.environment_id, declared_version: declared, registry_version: registryVersion };
}
