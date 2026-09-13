import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateJuiceShopBasketQuantity } from '../../src/oracles/juice-shop-basket-quantity.mjs';

const fakePage = ({ target = true, quantity = true, price = true, route = true } = {}) => ({
  url: () => route ? 'http://sut/#/basket' : 'http://sut/#/',
  locator: (selector) => selector === '.cell-initial-font'
    ? { allTextContents: async () => quantity ? [' Apple Juice (1000ml)', ' 2', ' 1.99¤'] : [' Apple Juice (1000ml)', ' 1', ' 1.99¤'] }
    : { innerText: async () => target ? 'Your Basket (anonymous) Apple Juice (1000ml) 2 3.98¤' : 'Your Basket (anonymous)' },
  getByText: (value) => ({ isVisible: async () => value === 'Your Basket (anonymous)' ? route : value === 'Apple Juice (1000ml)' ? target : value === 'Total Price: 3.98¤' ? price : false })
});

test('basket quantity oracle requires route, target, quantity two and total 3.98', async () => {
  assert.equal((await evaluateJuiceShopBasketQuantity(fakePage())).passed, true);
  assert.equal((await evaluateJuiceShopBasketQuantity(fakePage({ quantity: false }))).passed, false);
  assert.equal((await evaluateJuiceShopBasketQuantity(fakePage({ price: false }))).passed, false);
});

test('basket quantity fault oracle detects omitted target', async () => {
  assert.equal((await evaluateJuiceShopBasketQuantity(fakePage({ target: false }), { condition: 'functional-fault' })).passed, true);
  assert.equal((await evaluateJuiceShopBasketQuantity(fakePage(), { condition: 'functional-fault' })).passed, false);
});
