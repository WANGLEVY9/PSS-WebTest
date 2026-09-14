import assert from 'node:assert/strict';
import test from 'node:test';
import { probeWebArenaShoppingResetGate } from '../../scripts/probe-webarena-shopping-reset-gate.mjs';

const manifest = {
  mandatory_core: [{ id: 'webarena-verified', environment: { candidate_image: { reference: 'am1n3e/webarena-verified-shopping@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } } }]
};
const response = (status, json = null) => new Response(json ? JSON.stringify(json) : 'ok', { status });
const healthy = () => ({ success: true, details: { value: { services: { 'php-fpm': 'RUNNING' } } } });

test('reset gate requires at least three recovered restart cycles', async () => {
  const restarts = [];
  const result = await probeWebArenaShoppingResetGate({
    manifest,
    resetCycles: 3,
    execFile: (_command, args) => { restarts.push(args); return 'container'; },
    fetchImpl: async (url) => String(url).includes('status') ? response(200, healthy()) : response(302),
    sleep: async () => {},
    now: () => '2026-09-14T00:00:00.000Z'
  });
  assert.equal(result.ready, true);
  assert.equal(result.state_reset_verified, false);
  assert.equal(restarts.length, 3);
  assert.ok(result.cycle_results.every((cycle) => cycle.recovered));
});

test('reset gate fails closed when one restart cannot recover', async () => {
  let call = 0;
  const result = await probeWebArenaShoppingResetGate({
    manifest,
    resetCycles: 3,
    execFile: () => { call += 1; if (call === 2) throw new Error('restart failed'); return 'container'; },
    fetchImpl: async (url) => String(url).includes('status') ? response(200, healthy()) : response(200),
    sleep: async () => {},
    maxPolls: 1
  });
  assert.equal(result.ready, false);
  assert.equal(result.classification, 'infrastructure-gate-failed');
  assert.equal(result.cycle_results[1].recovered, false);
});
