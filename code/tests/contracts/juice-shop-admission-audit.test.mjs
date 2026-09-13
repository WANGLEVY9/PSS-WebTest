import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Juice Shop admission audit is fail-closed and never authorizes confirmatory collection', () => {
  const source = fs.readFileSync(new URL('../../scripts/juice-shop-admission-audit.mjs', import.meta.url), 'utf8');
  assert.match(source, /confirmatory_authorized: false/);
  assert.match(source, /belowRepetition/);
  assert.match(source, /missing_cells/);
  assert.match(source, /min_repetitions/);
});
