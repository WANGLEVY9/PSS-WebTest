import assert from 'node:assert/strict';
import test from 'node:test';
import { probeWebArenaShoppingStateResetGate } from '../../scripts/probe-webarena-shopping-state-reset-gate.mjs';

const imageDigest = 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const manifest = {
  mandatory_core: [{ id: 'webarena-verified', environment: { candidate_image: { reference: `am1n3e/webarena-verified-shopping@${imageDigest}` } } }]
};
const response = (status, json = null) => new Response(json ? JSON.stringify(json) : 'ok', { status });
const healthy = () => ({ success: true, details: { value: { services: { 'php-fpm': 'RUNNING' } } } });

test('state-reset gate is fail-closed without explicit recreate authorization', async () => {
  const result = await probeWebArenaShoppingStateResetGate({ manifest, allowRecreate: false, now: () => '2026-09-14T00:00:00.000Z' });
  assert.equal(result.ready, false);
  assert.equal(result.classification, 'recreate-not-authorized');
  assert.equal(result.study_execution_allowed, false);
});

test('cardinality/schema repeatability never proves restored task-state contents', async () => {
  const calls = [];
  const result = await probeWebArenaShoppingStateResetGate({
    manifest,
    allowRecreate: true,
    resetCycles: 3,
    execFile: (_command, args) => {
      calls.push(args);
      if (args[0] === 'inspect' && args[3] === '{{json .Mounts}}') return '[]';
      if (args[0] === 'inspect') return imageDigest;
      if (args[0] === 'exec' && args.includes('redis-cli')) return '27';
      if (args[0] === 'exec' && args.some((arg) => arg.includes('mysqldump'))) return 'schema';
      if (args[0] === 'exec') return 'table\t1\t2\t3';
      return 'container';
    },
    fetchImpl: async (url) => String(url).includes('status') ? response(200, healthy()) : response(302),
    sleep: async () => {},
    now: () => '2026-09-14T00:00:00.000Z'
  });
  assert.equal(result.ready, false);
  assert.equal(result.state_reset_verified, false);
  assert.equal(result.cardinality_repeatability_verified, true);
  assert.equal(result.classification, 'cardinality-repeatability-only');
  assert.equal(result.state_digest_stable, true);
  assert.equal(result.no_persistent_mounts, true);
  assert.equal(result.cycle_results.length, 3);
  assert.equal(calls.filter((args) => args[0] === 'run').length, 3);
});
