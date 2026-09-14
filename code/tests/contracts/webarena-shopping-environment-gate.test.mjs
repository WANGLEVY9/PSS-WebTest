import assert from 'node:assert/strict';
import test from 'node:test';
import { probeWebArenaShoppingGate } from '../../scripts/probe-webarena-shopping-gate.mjs';

const manifest = {
  mandatory_core: [{ id: 'webarena-verified', environment: { candidate_image: { reference: 'am1n3e/webarena-verified-shopping@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } } }]
};
const jsonResponse = (status, json) => new Response(JSON.stringify(json), { status, headers: { 'content-type': 'application/json' } });

test('WebArena environment gate accepts only matching image plus healthy controller and HTTP site', async () => {
  const result = await probeWebArenaShoppingGate({
    manifest,
    execFile: (_command, args) => args[0] === 'info' ? 'amd64' : args[0] === 'image' ? 'amd64' : 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    fetchImpl: async (url) => String(url).includes('status')
      ? jsonResponse(200, { success: true, details: { value: { services: { 'php-fpm': 'HEALTHY' } } } })
      : new Response('ok', { status: 200 }),
    now: () => '2026-09-14T00:00:00.000Z'
  });
  assert.equal(result.ready, true);
  assert.equal(result.classification, 'environment-ready');
  assert.equal(result.study_execution_allowed, false);
  assert.equal(result.architecture_compatible, true);
});

test('WebArena gate normalizes x86_64/amd64 and accepts a canonical HTTP redirect', async () => {
  const result = await probeWebArenaShoppingGate({
    manifest,
    execFile: (_command, args) => args[0] === 'info' ? 'x86_64' : args[0] === 'image' ? 'amd64' : 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    fetchImpl: async (url) => String(url).includes('status')
      ? jsonResponse(200, { success: true, details: { value: { services: { 'php-fpm': 'RUNNING' } } } })
      : new Response(null, { status: 302, headers: { location: 'http://localhost:7770/' } }),
    now: () => '2026-09-14T00:00:00.000Z'
  });
  assert.equal(result.ready, true);
  assert.equal(result.architecture_compatible, true);
  assert.equal(result.normalized_host_architecture, 'amd64');
  assert.equal(result.normalized_image_architecture, 'amd64');
  assert.equal(result.site.status, 302);
});

test('WebArena environment gate classifies PHP fatal and 502 as infrastructure failure, never an arm outcome', async () => {
  const result = await probeWebArenaShoppingGate({
    manifest,
    execFile: (_command, args) => args[0] === 'info' ? 'arm64' : args[0] === 'image' ? 'amd64' : 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    fetchImpl: async (url) => String(url).includes('status')
      ? jsonResponse(200, { success: false, details: { value: { services: { 'php-fpm': 'FATAL' } } } })
      : new Response('bad gateway', { status: 502 }),
    healthPolls: 1,
    sleep: async () => {}
  });
  assert.equal(result.ready, false);
  assert.equal(result.classification, 'infrastructure-gate-failed');
  assert.equal(result.php_fpm_service, 'FATAL');
  assert.equal(result.architecture_compatible, false);
});
