import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateJuiceShopProductDetail } from '../../src/oracles/juice-shop-product-detail.mjs';

const fakePage = ({ dialog = true, title = true, price = true, url = 'http://127.0.0.1:3000/#/' } = {}) => ({
  url: () => url,
  locator: () => ({
    isVisible: async () => dialog,
    getByText: (value) => ({ isVisible: async () => value.startsWith('Apple') ? title : price })
  })
});

test('product-detail oracle requires the target dialog and price', async () => {
  const pass = await evaluateJuiceShopProductDetail(fakePage());
  assert.equal(pass.passed, true);
  const missing = await evaluateJuiceShopProductDetail(fakePage({ price: false }));
  assert.equal(missing.passed, false);
});

test('product-detail fault oracle detects an omitted target without calling it clean', async () => {
  const fault = await evaluateJuiceShopProductDetail(fakePage({ dialog: false }), { condition: 'functional-fault' });
  assert.equal(fault.passed, true);
  assert.equal(fault.expected_verdict, 'fault');
  const clean = await evaluateJuiceShopProductDetail(fakePage(), { condition: 'functional-fault' });
  assert.equal(clean.passed, false);
});
