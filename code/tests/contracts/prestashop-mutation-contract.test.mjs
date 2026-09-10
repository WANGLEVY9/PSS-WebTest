import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getPrestashopMutation, listPrestashopMutations, mutationConfigPath } from '../../src/prestashop-mutations.mjs';

test('PrestaShop mutation catalog declares isolated fault and evolution candidates', () => {
  const config = JSON.parse(fs.readFileSync(mutationConfigPath(), 'utf8'));
  assert.equal(config.status, 'candidate-not-admitted');
  assert.equal(config.oracle_contract.hidden_from_testing_arms, true);
  assert.ok(listPrestashopMutations().some((mutation) => mutation.condition === 'functional-fault'));
  assert.ok(listPrestashopMutations().some((mutation) => mutation.condition === 'ui-evolution'));
});

test('PrestaShop mutation definitions are stable and uniquely addressable', () => {
  const ids = listPrestashopMutations().map((mutation) => mutation.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.equal(getPrestashopMutation(id).id, id);
  assert.match(path.basename(mutationConfigPath()), /^prestashop-mutations\.v0\.1\.json$/);
});
