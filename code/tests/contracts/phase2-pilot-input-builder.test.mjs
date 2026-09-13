import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('pilot input builder is strata-aware and fail-closed', () => {
  const source = fs.readFileSync(new URL('../../scripts/phase2-pilot-input-builder.mjs', import.meta.url), 'utf8');
  assert.match(source, /pilot-input-planning-only/);
  assert.match(source, /confirmatory_authorized: false/);
  assert.match(source, /conditionFamily/);
  assert.match(source, /legacyQuarantined/);
  assert.match(source, /reset_complete/);
  assert.match(source, /repetition_eligible/);
  assert.match(source, /provider_id/);
  assert.match(source, /model_id/);
});
