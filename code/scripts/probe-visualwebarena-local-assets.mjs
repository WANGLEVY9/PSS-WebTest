#!/usr/bin/env node
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const codeRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const snapshotRoot = path.join(codeRoot, 'artifacts', 'benchmark-snapshots', 'visualwebarena');
const expectedImages = {
  shopping: 'shopping_final_0712',
  reddit: 'postmill-populated-exposed-withimg'
};

function defaultExecFile(command, args) {
  return childProcess.execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function dockerList(execFile, args) {
  try { return execFile('docker', args); } catch { return ''; }
}

function imageAvailable(imagesOutput, imageName) {
  return imagesOutput.split(/\r?\n/).some((line) => line.trim().split(/\s+/)[0] === imageName);
}

export function probeVisualWebArenaLocalAssets({
  execFile = defaultExecFile,
  root = snapshotRoot,
  now = () => new Date().toISOString(),
  resetToken = process.env.PSS_VWA_CLASSIFIEDS_RESET_TOKEN ?? ''
} = {}) {
  let dockerArchitecture = null;
  let dockerError = null;
  try { dockerArchitecture = execFile('docker', ['info', '--format', '{{.Architecture}}']); }
  catch (error) { dockerError = String(error?.stderr ?? error?.message ?? error); }
  const imagesOutput = dockerList(execFile, ['images', '--format', '{{.Repository}}:{{.Tag}}']);
  const containersOutput = dockerList(execFile, ['ps', '--format', '{{.Names}}\\t{{.Image}}\\t{{.Ports}}']);
  const classifiedCompose = [
    path.join(root, 'environment_docker', 'classifieds_docker_compose', 'docker-compose.yml'),
    path.join(root, 'environment_docker', 'classifieds_docker_compose', 'classifieds_docker_compose', 'docker-compose.yml')
  ].find((candidate) => fs.existsSync(candidate)) ?? null;
  const homepageSource = path.join(root, 'environment_docker', 'webarena-homepage');
  const assets = {
    shopping_image_present: imageAvailable(imagesOutput, expectedImages.shopping),
    reddit_image_present: imageAvailable(imagesOutput, expectedImages.reddit),
    classifieds_compose_present: Boolean(classifiedCompose),
    homepage_source_present: fs.existsSync(path.join(homepageSource, 'templates', 'index.html')),
    reset_token_configured: typeof resetToken === 'string' && resetToken.trim().length >= 8
  };
  const missing = Object.entries(assets).filter(([, present]) => !present).map(([name]) => name);
  return {
    schema_version: '1.0',
    kind: 'visualwebarena-local-assets-probe',
    observed_at: now(),
    pinned_source_commit: '89f5af29305c3d1e9f97ce4421462060a70c9a03',
    docker_architecture: dockerArchitecture,
    docker_error: dockerError,
    expected_images: expectedImages,
    images_observed: imagesOutput ? imagesOutput.split(/\r?\n/).filter(Boolean) : [],
    running_containers_observed: containersOutput ? containersOutput.split(/\r?\n/).filter(Boolean) : [],
    classifieds_compose_path: classifiedCompose,
    assets,
    missing_assets: missing,
    ready_for_service_start: missing.length === 0,
    classification: missing.length === 0 ? 'assets-ready-service-start-pending' : 'official-assets-missing',
    study_execution_allowed: false
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const result = probeVisualWebArenaLocalAssets();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ready_for_service_start) process.exitCode = 2;
}
