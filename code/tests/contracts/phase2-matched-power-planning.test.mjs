import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('matched power planner remains planning-only and preserves model strata', () => {
  const source = fs.readFileSync(new URL('../../scripts/phase2-matched-power-planning.mjs', import.meta.url), 'utf8');
  assert.match(source, /planning-only-not-frozen/);
  assert.match(source, /confirmatory_authorized: false/);
  assert.match(source, /model_strata/);
  assert.match(source, /matched_blocks/);
  assert.match(source, /per_cell_repetitions/);
  assert.match(source, /execution_variant/);
});
