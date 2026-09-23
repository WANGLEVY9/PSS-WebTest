import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const FIXTURE_FILES = ['docker-compose.yml', 'mysql/classifieds_restore.sql', 'mysql/init_db.sh', 'mysql/osclass_craigslist.sql'];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = code => { throw new Error(code); };
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('\n') === [...keys].sort().join('\n');
const absolute = value => typeof value === 'string' && path.isAbsolute(value) && !/[\0\r\n]/.test(value);
const digestRef = value => typeof value === 'string' && /^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/.test(value);

export function readVwaProvisionProfile(filename) {
  const raw = fs.readFileSync(filename);
  const p = JSON.parse(raw);
  if (!exactKeys(p, ['schema', 'docker_context', 'project_name', 'fixture_root', 'fixture_files', 'images', 'credentials_file', 'output_dir', 'required_free_bytes']) || p.schema !== 'pss-vwa-provision-v1') fail('invalid-profile-schema');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(p.docker_context) || !/^pss-vwa-[a-z0-9][a-z0-9_-]{0,50}$/.test(p.project_name)) fail('invalid-context-or-project');
  if (![p.fixture_root, p.credentials_file, p.output_dir].every(absolute)) fail('absolute-paths-required');
  if (!exactKeys(p.images, ['web', 'db']) || !Object.values(p.images).every(digestRef)) fail('immutable-image-digests-required');
  if (!Number.isSafeInteger(p.required_free_bytes) || p.required_free_bytes < 5 * 1024 ** 3) fail('provisioning-reserve-required');
  if (!exactKeys(p.fixture_files, FIXTURE_FILES) || !Object.values(p.fixture_files).every(x => /^[a-f0-9]{64}$/.test(x))) fail('complete-fixture-manifest-required');
  const fixture = fs.realpathSync(p.fixture_root);
  if (fixture.split(path.sep).includes('benchmark-snapshots')) fail('fixture-must-be-outside-official-source');
  const observed = [];
  const walk = dir => {
    for (const e of fs.readdirSync(dir, {withFileTypes:true})) {
      const item = path.join(dir, e.name);
      if (e.isSymbolicLink()) fail('fixture-symlink-forbidden');
      if (e.isDirectory()) walk(item);
      else if (e.isFile()) observed.push(path.relative(fixture, item).split(path.sep).join('/'));
      else fail('fixture-nonregular-file');
    }
  };
  walk(fixture);
  if (observed.sort().join('\n') !== [...FIXTURE_FILES].sort().join('\n')) fail('fixture-file-set-mismatch');
  for (const name of FIXTURE_FILES) if (sha256(fs.readFileSync(path.join(fixture, name))) !== p.fixture_files[name]) fail('fixture-hash-mismatch');
  const credentials = fs.statSync(p.credentials_file);
  if (!credentials.isFile() || (credentials.mode & 0o077)) fail('credentials-must-be-private-file');
  const values = {};
  for (const line of fs.readFileSync(p.credentials_file, 'utf8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = /^(PSS_VWA_CLASSIFIEDS_RESET_TOKEN|PSS_VWA_DB_PASSWORD)=([A-Za-z0-9_.-]+)$/.exec(line);
    if (!match || values[match[1]]) fail('invalid-credential-file');
    values[match[1]] = match[2];
  }
  if (!values.PSS_VWA_CLASSIFIEDS_RESET_TOKEN || values.PSS_VWA_CLASSIFIEDS_RESET_TOKEN.length < 16 || !values.PSS_VWA_DB_PASSWORD) fail('missing-runtime-credentials');
  const output = fs.realpathSync(p.output_dir);
  if (output.split(path.sep).includes('benchmark-snapshots') || output === fixture || output.startsWith(fixture + path.sep)) fail('output-must-be-separate-from-sources-and-fixtures');
  return {profile: {...p, fixture_root:fixture, output_dir:output}, profile_sha256:sha256(raw)};
}

export function assertVwaDaemon(profile, context, daemon) {
  if (context.Name !== profile.docker_context || typeof context.Endpoints?.docker?.Host !== 'string') fail('docker-context-mismatch');
  if (daemon.OSType !== 'linux' || !['amd64','x86_64'].includes(daemon.Architecture)) fail('linux-amd64-daemon-required');
  return {context:context.Name, endpoint:context.Endpoints.docker.Host, docker_root_dir:daemon.DockerRootDir};
}

// No host-free-space substitution for a VM or remote daemon. A new provider-specific
// measurement adapter must be reviewed before supporting those pull environments.
export function validateVwaPullCapacity(profile, context, daemon, manifests, {platform=process.platform, architecture=process.arch, statfs=fs.statfsSync}={}) {
  assertVwaDaemon(profile, context, daemon);
  if (platform !== 'linux' || architecture !== 'x64' || !context.Endpoints.docker.Host.startsWith('unix://')) fail('pull-requires-measurable-native-local-storage');
  if (!absolute(daemon.DockerRootDir)) fail('docker-root-dir-unavailable');
  let compressed = 0;
  for (const role of ['web','db']) {
    const manifest = manifests[role];
    const descriptor = manifest?.Descriptor;
    const layers = manifest?.SchemaV2Manifest?.layers;
    if (!descriptor || descriptor.digest !== profile.images[role].split('@')[1] || descriptor.platform?.os !== 'linux' || descriptor.platform?.architecture !== 'amd64' || !Array.isArray(layers) || !layers.length || !layers.every(x => Number.isSafeInteger(x.size) && x.size >= 0)) fail('single-platform-image-manifest-required');
    compressed += layers.reduce((sum, x) => sum + x.size, 0);
  }
  const stat = statfs(daemon.DockerRootDir, {bigint:true});
  const available = BigInt(stat.bavail) * BigInt(stat.bsize);
  const required = BigInt(Math.max(profile.required_free_bytes, 2 * compressed + 5 * 1024 ** 3));
  if (available < required) fail('insufficient-docker-storage');
  return {available_bytes:String(available), required_bytes:String(required), compressed_bytes:compressed, scope:'provisioning-only-not-scientific-admission'};
}

export function vwaComposeInvocation(profile, composeFile, action) {
  if (!['config','ps','pull','up'].includes(action)) fail('unsupported-action');
  const command = action === 'config' ? ['config','--quiet'] : action === 'up' ? ['up','--pull','never','--no-build','--detach'] : [action];
  return {command:'docker', args:['--context',profile.docker_context,'compose','--project-name',profile.project_name,'--env-file',profile.credentials_file,'-f',composeFile,...command],
    env:{PSS_VWA_CLASSIFIEDS_IMAGE:profile.images.web,PSS_VWA_DB_IMAGE:profile.images.db,PSS_VWA_FIXTURE_MYSQL:path.join(profile.fixture_root,'mysql')}};
}
