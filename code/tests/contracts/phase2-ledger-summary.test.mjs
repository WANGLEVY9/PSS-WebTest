import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('phase2 ledger summary stays descriptive and strata-aware', () => {
  const source = fs.readFileSync(new URL('../../scripts/phase2-ledger-summary.mjs', import.meta.url), 'utf8');
  assert.match(source, /pilot-diagnostic-not-confirmatory/);
  assert.match(source, /confirmatory_authorized: false/);
  assert.match(source, /legacy_quarantined/);
  assert.match(source, /provider_id/);
  assert.match(source, /model_id/);
  assert.match(source, /failure_categories/);
  assert.match(source, /executionVariant/);
  assert.match(source, /execution_variant/);
});
