import test from 'node:test';
import assert from 'node:assert/strict';
import { installJuiceShopFeedbackDelay } from '../../src/mutations/juice-shop.mjs';

test('Juice Shop feedback delay is page-scoped and keeps a bounded delay declaration', async () => {
  let initScript;
  const page = { addInitScript: async (script, args) => { initScript = { script, args }; } };
  const result = await installJuiceShopFeedbackDelay(page, { delayMs: 1200 });
  assert.equal(result.mutation, 'juice-basket-feedback-delay');
  assert.equal(result.delay_ms, 1200);
  assert.equal(typeof initScript.script, 'function');
  assert.deepEqual(initScript.args, { delay: 1200 });
});
