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
    execFile: () => 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    fetchImpl: async (url) => String(url).includes('status')
      ? jsonResponse(200, { success: true, details: { value: { services: { 'php-fpm': 'HEALTHY' } } } })
      : new Response('ok', { status: 200 }),
    now: () => '2026-09-14T00:00:00.000Z'
  });
  assert.equal(result.ready, true);
  assert.equal(result.classification, 'environment-ready');
  assert.equal(result.study_execution_allowed, false);
});

test('WebArena environment gate classifies PHP fatal and 502 as infrastructure failure, never an arm outcome', async () => {
  const result = await probeWebArenaShoppingGate({
    manifest,
    execFile: () => 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    fetchImpl: async (url) => String(url).includes('status')
      ? jsonResponse(200, { success: false, details: { value: { services: { 'php-fpm': 'FATAL' } } } })
      : new Response('bad gateway', { status: 502 })
  });
  assert.equal(result.ready, false);
  assert.equal(result.classification, 'infrastructure-gate-failed');
  assert.equal(result.php_fpm_service, 'FATAL');
});
