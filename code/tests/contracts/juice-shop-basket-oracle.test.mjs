import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateJuiceShopBasket } from '../../src/oracles/juice-shop-basket.mjs';

const fakePage = ({ route = true, heading = true, target = true, quantity = true, price = true } = {}) => ({
  url: () => route ? 'http://127.0.0.1:3000/#/basket' : 'http://127.0.0.1:3000/#/',
  locator: (selector) => selector === '.cell-initial-font'
    ? { allTextContents: async () => target ? [' 1'] : [] }
    : { innerText: async () => target ? 'Your Basket (anonymous)\nApple Juice (1000ml)\n1\n1.99¤' : 'Your Basket (anonymous)\n1' },
  getByText: (value) => ({ isVisible: async () => value === 'Your Basket (anonymous)' ? heading : value === 'Apple Juice (1000ml)' ? target : value === '1.99¤' ? price : quantity })
});

test('basket oracle requires route, heading, target, quantity, and price', async () => {
  assert.equal((await evaluateJuiceShopBasket(fakePage())).passed, true);
  assert.equal((await evaluateJuiceShopBasket(fakePage({ price: false }))).passed, false);
});

test('basket fault oracle accepts a visible target omission only under fault condition', async () => {
  const fault = await evaluateJuiceShopBasket(fakePage({ target: false, quantity: false, price: false }), { condition: 'functional-fault' });
  assert.equal(fault.passed, true);
  assert.equal((await evaluateJuiceShopBasket(fakePage(), { condition: 'functional-fault' })).passed, false);
});
