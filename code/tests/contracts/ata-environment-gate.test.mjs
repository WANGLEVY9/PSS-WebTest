import assert from 'node:assert/strict';
import test from 'node:test';
import { probeAtaEnvironmentGate } from '../../scripts/probe-ata-environment-gate.mjs';

const manifest = { mandatory_core: [{ id: 'autonomous-tester-agent-benchmark', source_commit: 'a'.repeat(40) }] };
const services = { classifieds: 'http://classifieds/', shopping: 'http://shopping/', postmill: 'http://postmill/' };

test('ATA gate is fail-closed without remote reset credential', async () => {
  const result = await probeAtaEnvironmentGate({ manifest, services, githubToken: '', fetchImpl: async () => ({ status: 200, ok: true }) });
  assert.equal(result.services_reachable, true);
  assert.equal(result.reset_credential_configured, false);
  assert.equal(result.evaluator_independence_verified, false);
  assert.equal(result.ready, false);
  assert.equal(result.study_execution_allowed, false);
});

test('ATA gate records service failures as infrastructure and never as arm outcomes', async () => {
  const result = await probeAtaEnvironmentGate({
    manifest, services, githubToken: 'token-1234',
    fetchImpl: async (url) => url.includes('postmill') ? Promise.reject(new Error('connection refused')) : ({ status: 200, ok: true })
  });
  assert.equal(result.services_reachable, false);
  assert.equal(result.services.postmill.reachable, false);
  assert.equal(result.classification, 'infrastructure-gate-failed');
  assert.equal(result.study_execution_allowed, false);
});

test('ATA gate does not authorize execution while evaluator independence is unverified', async () => {
  const result = await probeAtaEnvironmentGate({ manifest, services, githubToken: 'token-1234', fetchImpl: async () => ({ status: 302, ok: false }) });
  assert.equal(result.services_reachable, true);
  assert.equal(result.evaluator_independence_verified, false);
  assert.equal(result.ready, false);
});
