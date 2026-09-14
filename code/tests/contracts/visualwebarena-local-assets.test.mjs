import assert from 'node:assert/strict';
import test from 'node:test';
import { probeVisualWebArenaLocalAssets } from '../../scripts/probe-visualwebarena-local-assets.mjs';

function fakeExec(values) {
  return (command, args) => {
    const key = `${command} ${args.join(' ')}`;
    if (key.includes('docker info')) return values.architecture ?? 'amd64';
    if (key.includes('docker images')) return values.images ?? '';
    if (key.includes('docker ps')) return values.containers ?? '';
    throw new Error(`unexpected command: ${key}`);
  };
}

test('asset probe reports exact missing official assets without authorizing execution', () => {
  const result = probeVisualWebArenaLocalAssets({
    root: '/tmp/nonexistent-vwa-root',
    resetToken: '',
    execFile: fakeExec({ images: 'am1n3e/webarena-verified-shopping:latest', containers: '' })
  });
  assert.equal(result.ready_for_service_start, false);
  assert.deepEqual(result.missing_assets, [
    'shopping_image_present', 'reddit_image_present', 'classifieds_compose_present',
    'homepage_source_present', 'reset_token_configured'
  ]);
  assert.equal(result.study_execution_allowed, false);
});

test('asset probe recognizes the canonical image names and local sources', () => {
  const result = probeVisualWebArenaLocalAssets({
    root: process.cwd(),
    resetToken: 'token-1234',
    execFile: fakeExec({
      images: 'shopping_final_0712\npostmill-populated-exposed-withimg',
      containers: 'forum\tpostmill-populated-exposed-withimg\t0.0.0.0:9999->80/tcp'
    })
  });
  // The repository intentionally does not vendor the 49.7 GB/compose assets;
  // the image/source fields remain false even when image names are available.
  assert.equal(result.assets.shopping_image_present, true);
  assert.equal(result.assets.reddit_image_present, true);
  assert.equal(result.study_execution_allowed, false);
});
