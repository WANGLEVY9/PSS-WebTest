import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRunRecord } from '../../src/run-records.mjs';

test('WebTestPilot lifecycle binds seed and snapshot counts into a reset digest', () => {
  const source = fs.readFileSync(new URL('../../scripts/webtestpilot-lifecycle.mjs', import.meta.url), 'utf8');
  assert.match(source, /createHash\('sha256'\)/);
  assert.match(source, /seed_digest/);
  assert.match(source, /reset_contract/);
  assert.match(source, /reset_digest/);
});

test('PrestaShop matched controller propagates lifecycle reset digest', () => {
  const source = fs.readFileSync(new URL('../../scripts/prestashop-matched-pilot.mjs', import.meta.url), 'utf8');
  assert.match(source, /seedVerified\?\.reset_digest/);
  assert.match(source, /resetDigest/);
  assert.match(source, /reset_contract/);
});

test('pilot v0.1 records may carry reset evidence without becoming v0.2', () => {
  const record = createRunRecord({
    run_id: 'prestashop-reset-evidence-r01', application_id: 'prestashop', application_version: '8-local',
    task_id: 'prestashop-buyer-search-product', condition: 'clean-stable', arm: 'playwright',
    status: 'completed', checkpoint_reached: true, independent_oracle_passed: true,
    emitted_verdict: 'clean', ground_truth_verdict: 'clean',
    timing: { wall_time_ms: 1, actions: 1, retries: 0 },
    provenance: { runner_version: 'contract-test', observation_contract: 'scripted-locator' },
    reset_digest: 'a'.repeat(64), reset_contract: 'prestashop-seeded-state-digest-v1',
    randomization_block: 'prestashop-clean-r01-playwright-visual-hybrid'
  });
  assert.equal(record.schema_version, '0.1');
  assert.equal(record.reset_digest, 'a'.repeat(64));
  assert.equal(record.reset_contract, 'prestashop-seeded-state-digest-v1');
});

test('Invoice Ninja controller propagates reset evidence to every arm', () => {
  const controller = fs.readFileSync(new URL('../../scripts/invoiceninja-matched-pilot.mjs', import.meta.url), 'utf8');
  const agent = fs.readFileSync(new URL('../../scripts/run-invoiceninja-agent-cell.mjs', import.meta.url), 'utf8');
  const scripted = fs.readFileSync(new URL('../../scripts/run-invoiceninja-playwright-cell.mjs', import.meta.url), 'utf8');
  assert.match(controller, /reset_digest/);
  assert.match(controller, /PSS_RANDOMIZATION_BLOCK/);
  assert.match(agent, /PSS_RESET_DIGEST/);
  assert.match(scripted, /PSS_RESET_DIGEST/);
  assert.match(controller, /PSS_PILOT_CONDITIONS/);
  assert.match(controller, /PSS_PILOT_ARMS/);
});
