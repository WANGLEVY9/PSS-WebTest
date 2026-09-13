import test from 'node:test';
import assert from 'node:assert/strict';
import { installJuiceShopPaginationOmission } from '../../src/mutations/juice-shop-pagination.mjs';

test('Juice Shop pagination omission preserves response schema and removes exactly the declared target', async () => {
  let handler;
  const page = { route: async (_pattern, callback) => { handler = callback; } };
  await installJuiceShopPaginationOmission(page);
  const route = {
    fetch: async () => new Response(JSON.stringify({ data: [
      { name: 'Lemon Juice (500ml)' }, { name: 'Melon Juice (1000ml)' }
    ], total: 2 }), { headers: { 'content-type': 'application/json' } }),
    fulfill: async (value) => { route.fulfilled = value; }
  };
  await handler(route);
  const payload = JSON.parse(route.fulfilled.body);
  assert.deepEqual(payload.data, [{ name: 'Melon Juice (1000ml)' }]);
  assert.equal(payload.total, 2);
});
