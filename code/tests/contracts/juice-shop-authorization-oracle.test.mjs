import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateJuiceShopAuthorization } from '../../src/oracles/juice-shop-authorization.mjs';

const fakePage = ({ denied = true, route = true } = {}) => ({
  url: () => route ? 'http://sut/#/administration' : 'http://sut/#/',
  locator: () => ({ innerText: async () => denied ? '403\nYou are not allowed to access this page!' : 'Administration' })
});

test('authorization oracle requires route and anonymous denial', async () => {
  assert.equal((await evaluateJuiceShopAuthorization(fakePage())).passed, true);
  assert.equal((await evaluateJuiceShopAuthorization(fakePage({ route: false }))).passed, false);
});

test('authorization fault oracle detects missing denial on the administration route', async () => {
  assert.equal((await evaluateJuiceShopAuthorization(fakePage({ denied: false }), { condition: 'functional-fault' })).passed, true);
  assert.equal((await evaluateJuiceShopAuthorization(fakePage(), { condition: 'functional-fault' })).passed, false);
});
