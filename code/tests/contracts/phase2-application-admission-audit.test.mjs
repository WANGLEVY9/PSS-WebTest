import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('cross-application admission audit remains fail-closed and preserves the five-SUT scope', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../../config/phase2-application-admission-manifest.v0.1.json', import.meta.url), 'utf8'));
  const source = fs.readFileSync(new URL('../../scripts/phase2-application-admission-audit.mjs', import.meta.url), 'utf8');
  assert.deepEqual(manifest.applications.map((app) => app.id), ['bookstack', 'indico', 'juice-shop', 'invoiceninja', 'prestashop']);
  assert.equal(manifest.target.planned_workflows_per_application, 8);
  assert.match(source, /confirmatory_authorized: false/);
  assert.match(source, /blocked-workflow-breadth/);
  assert.match(source, /live_provider_strata_below_min/);
  assert.match(source, /conditionFamily/);
  assert.match(source, /functional-fault/);
  assert.match(source, /observed_conditions/);
  assert.match(source, /executionVariant/);
  assert.match(source, /execution_variant/);
});
