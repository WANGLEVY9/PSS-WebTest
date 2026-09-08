import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyControllerBoundary, evaluateBatchAuthorisation } from '../../src/exploratory-batch-guards.mjs';

const manifest = { status: 'prepared-not-authorized-for-execution', provider_model_stratum: 'provider/model', guardrails: { max_agent_decisions_per_block: 32 } };

test('batch execution requires a matching profile, explicit request cap, wall cap, and execute flag', () => {
  const refused = evaluateBatchAuthorisation({ manifest, currentProfile: 'provider/model', executeFlag: undefined, maxProviderRequests: 160, maxWallMinutes: 30, selectedBlockCount: 5 });
  assert.match(refused.errors.join('\n'), /PSS_BATCH_EXECUTE/);
  const admitted = evaluateBatchAuthorisation({ manifest, currentProfile: 'provider/model', executeFlag: '1', maxProviderRequests: 160, maxWallMinutes: 30, selectedBlockCount: 5 });
  assert.deepEqual(admitted.errors, []);
  assert.equal(admitted.requiredRequests, 160);
});

test('batch controller classifier distinguishes provider/reset boundaries and full three-arm output', () => {
  const provider = classifyControllerBoundary({ code: 1, stdout: '{"arm":"visual","failure_category":"provider"}\n{"arm":"hybrid"}\n{"arm":"playwright"}', stderr: '' });
  assert.equal(provider.providerFailure, true);
  assert.equal(provider.fullThreeArmRecord, true);
  const reset = classifyControllerBoundary({ code: 1, stdout: '{"reset_ok":false}', stderr: '' });
  assert.equal(reset.resetFailure, true);
  assert.equal(reset.fullThreeArmRecord, false);
});
