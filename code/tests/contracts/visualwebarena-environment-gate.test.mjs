import assert from 'node:assert/strict';
import test from 'node:test';
import { probeVisualWebArenaEnvironmentGate } from '../../scripts/probe-visualwebarena-environment-gate.mjs';

const manifest = { mandatory_core: [{ id: 'visualwebarena', source_commit: 'a'.repeat(40) }] };
const services = { classifieds: 'http://classifieds/', shopping: 'http://shopping/', reddit: 'http://reddit/', homepage: 'http://homepage/' };

test('VisualWebArena gate requires every service and the reset token', async () => {
  const result = await probeVisualWebArenaEnvironmentGate({ manifest, services, classifiedsResetToken: '', fetchImpl: async () => ({ status: 200, ok: true }) });
  assert.equal(result.ready, false);
  assert.equal(result.classification, 'infrastructure-gate-failed');
  assert.equal(result.study_execution_allowed, false);
});

test('VisualWebArena gate admits only healthy services with a configured reset token', async () => {
  const result = await probeVisualWebArenaEnvironmentGate({ manifest, services, classifiedsResetToken: 'token-1234', fetchImpl: async () => ({ status: 200, ok: true }) });
  assert.equal(result.ready, true);
  assert.equal(result.classification, 'environment-ready');
});

test('VisualWebArena gate treats a canonical HTTP redirect as reachable', async () => {
  const result = await probeVisualWebArenaEnvironmentGate({ manifest, services, classifiedsResetToken: 'token-1234', fetchImpl: async () => ({ status: 302, ok: false }) });
  assert.equal(result.ready, true);
  assert.equal(result.services.shopping.status, 302);
  assert.equal(result.services.shopping.reachable, true);
});

test('VisualWebArena gate classifies a missing service as infrastructure, not an arm outcome', async () => {
  const result = await probeVisualWebArenaEnvironmentGate({ manifest, services, classifiedsResetToken: 'token-1234', fetchImpl: async (url) => url.includes('reddit') ? Promise.reject(new Error('connection refused')) : ({ status: 200, ok: true }) });
  assert.equal(result.ready, false);
  assert.equal(result.services.reddit.ok, false);
  assert.equal(result.study_execution_allowed, false);
});
