import test from 'node:test';
import assert from 'node:assert/strict';
import { installJuiceShopAuthorizationFault } from '../../src/mutations/juice-shop.mjs';

test('authorization fault mutation is page-scoped and targets only the denial card', async () => {
  let script;
  const page = { addInitScript: async (fn) => { script = fn; } };
  const result = await installJuiceShopAuthorizationFault(page);
  assert.equal(result.mutation, 'juice-authorization-denial-omission');
  assert.equal(result.semantics_preserved, false);
  assert.equal(typeof script, 'function');
});
