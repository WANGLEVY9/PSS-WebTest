import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateJuiceShopPagination } from '../../src/oracles/juice-shop-pagination.mjs';

const fakePage = ({ paginator = 'Items per page:\n15\n16 – 30 of 46', target = true } = {}) => ({
  locator: (selector) => selector === 'mat-paginator'
    ? { innerText: async () => paginator }
    : { innerText: async () => '' },
  getByText: (value) => ({ isVisible: async () => value === 'Lemon Juice (500ml)' ? target : false }),
  getByRole: () => ({ isDisabled: async () => false })
});

test('pagination oracle requires second-page state and exact target', async () => {
  assert.equal((await evaluateJuiceShopPagination(fakePage())).passed, true);
  assert.equal((await evaluateJuiceShopPagination(fakePage({ target: false }))).passed, false);
});

test('pagination fault oracle accepts target omission only on the second page', async () => {
  const fault = await evaluateJuiceShopPagination(fakePage({ target: false }), { condition: 'functional-fault' });
  assert.equal(fault.passed, true);
  assert.equal((await evaluateJuiceShopPagination(fakePage(), { condition: 'functional-fault' })).passed, false);
  assert.equal((await evaluateJuiceShopPagination(fakePage({ target: false, paginator: 'Items per page:\n15\n1 – 15 of 46' }), { condition: 'functional-fault' })).passed, false);
});
