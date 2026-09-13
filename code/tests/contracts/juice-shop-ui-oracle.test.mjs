import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateJuiceShopUiSearch } from '../../src/oracles/juice-shop-ui-search.mjs';
import { evaluateJuiceShopCondition } from '../../src/oracles/juice-shop-condition.mjs';

function fakePage({ url, value = 'apple', textboxVisible = true, visible = new Set(['Apple Juice (1000ml)', 'Apple Pomace', 'Pineapple Juice (1000ml)']) }) {
  const locator = (selector) => ({
    async innerText() { return [...visible].join('\n'); },
    first() { return this; },
    async isVisible() { return selector === 'body' || (selector === 'textbox' && textboxVisible) || visible.has(selector); },
    async inputValue() { return value; }
  });
  return {
    url: () => url,
    locator,
    getByRole: () => locator('textbox'),
    getByText: (text) => locator(text)
  };
}

test('visible UI oracle passes only after route, textbox, and result checks', async () => {
  const result = await evaluateJuiceShopUiSearch(fakePage({ url: 'http://localhost:3000/#/search;query=apple' }));
  assert.equal(result.passed, true);
  assert.equal(result.oracle, 'visible-ui-search-postcondition');
});

test('visible UI oracle rejects initial-page product markers without search route', async () => {
  const result = await evaluateJuiceShopUiSearch(fakePage({ url: 'http://localhost:3000/#/home' }));
  assert.equal(result.passed, false);
  assert.equal(result.query_in_route, false);
});

test('visible UI oracle rejects a negative control still visible', async () => {
  const result = await evaluateJuiceShopUiSearch(fakePage({
    url: 'http://localhost:3000/#/search;query=apple',
    visible: new Set(['Apple Juice (1000ml)', 'Apple Pomace', 'Pineapple Juice (1000ml)', 'Banana Juice (1000ml)'])
  }));
  assert.equal(result.passed, false);
  assert.deepEqual(result.visible_negative_names, ['Banana Juice (1000ml)']);
});

test('visible UI oracle accepts a result route that hides the search textbox', async () => {
  const result = await evaluateJuiceShopUiSearch(fakePage({
    url: 'http://localhost:3000/#/search?q=apple',
    textboxVisible: false,
    visible: new Set(['Apple Juice (1000ml)', 'Apple Pomace', 'Pineapple Juice (1000ml)'])
  }));
  assert.equal(result.passed, true);
});

test('condition oracle treats the seeded product omission as an independent fault postcondition', async () => {
  const result = await evaluateJuiceShopCondition(fakePage({
    url: 'http://localhost:3000/#/search;query=apple',
    visible: new Set(['Apple Juice (1000ml)', 'Pineapple Juice (1000ml)'])
  }), { condition: 'functional-fault' });
  assert.equal(result.expected_verdict, 'fault');
  assert.equal(result.fault_detected, true);
  assert.equal(result.passed, true);
});

test('condition oracle refuses to call a clean search a fault when the omitted product is visible', async () => {
  const result = await evaluateJuiceShopCondition(fakePage({
    url: 'http://localhost:3000/#/search;query=apple'
  }), { condition: 'functional-fault' });
  assert.equal(result.fault_detected, false);
  assert.equal(result.passed, false);
});
