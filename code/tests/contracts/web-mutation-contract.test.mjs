import test from 'node:test';
import assert from 'node:assert/strict';
import { installJuiceShopSearchOmission, installJuiceShopLayoutEvolution } from '../../src/mutations/juice-shop.mjs';
import { installIndicoLayoutEvolution } from '../../src/mutations/indico.mjs';

test('Juice Shop omission mutation preserves response schema and removes exactly one product', async () => {
  let handler;
  const page = { route: async (pattern, fn) => { assert.equal(pattern, '**/rest/products/search**'); handler = fn; } };
  const result = await installJuiceShopSearchOmission(page);
  assert.deepEqual(result, { mutation: 'juice-search-result-omission', omit_name: 'Apple Pomace' });
  let fulfilled;
  await handler({
    fetch: async () => ({
      json: async () => ({ data: [{ name: 'Apple Juice (1000ml)' }, { name: 'Apple Pomace' }] })
    }),
    fulfill: async (value) => { fulfilled = value; }
  });
  assert.deepEqual(JSON.parse(fulfilled.body), { data: [{ name: 'Apple Juice (1000ml)' }] });
  assert.equal(fulfilled.contentType, 'application/json; charset=utf-8');
});

for (const [name, installer, marker] of [
  ['Juice Shop', installJuiceShopLayoutEvolution, 'juice-layout-v1'],
  ['Indico', installIndicoLayoutEvolution, 'indico-layout-v1']
]) {
  test(`${name} layout mutation is installed as an init script`, async () => {
    let script;
    const page = { addInitScript: async (fn) => { script = fn.toString(); } };
    const result = await installer(page);
    assert.equal(result.semantics_preserved, true);
    assert.match(script, new RegExp(marker));
    assert.match(script, /MutationObserver/);
  });
}

