import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateJuiceShopBasketFeedback } from '../../src/oracles/juice-shop-basket-feedback.mjs';

const fakePage = ({ target = true, confirmation = true } = {}) => ({
  getByText: (value) => ({ isVisible: async () => value === 'Apple Juice (1000ml)' ? target : confirmation }),
  locator: () => ({ innerText: async () => `${target ? 'Apple Juice (1000ml)' : ''}${confirmation ? 'Placed Apple Juice (1000ml) into basket.' : ''}` })
});

test('basket feedback oracle requires target and delayed confirmation', async () => {
  assert.equal((await evaluateJuiceShopBasketFeedback(fakePage())).passed, true);
  assert.equal((await evaluateJuiceShopBasketFeedback(fakePage({ confirmation: false }))).passed, false);
});

test('basket feedback fault oracle requires both target and confirmation to be absent', async () => {
  assert.equal((await evaluateJuiceShopBasketFeedback(fakePage({ target: false, confirmation: false }), { condition: 'functional-fault' })).passed, true);
  assert.equal((await evaluateJuiceShopBasketFeedback(fakePage({ target: false, confirmation: true }), { condition: 'functional-fault' })).passed, false);
});
