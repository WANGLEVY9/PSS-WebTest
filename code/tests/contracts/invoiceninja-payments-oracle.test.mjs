import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInvoiceNinjaPaymentsSql, evaluateInvoiceNinjaPayment, resolveInvoiceNinjaPaymentsDbConfig } from '../../src/invoiceninja-payments-oracle.mjs';

const seeded = '1\t1\t4\t120000.000000\t0.000000\t120000.000000\t2025-10-07\t0001\t0\n';

test('accepts the seeded payment row using an independent database query', async () => {
  const result = await evaluateInvoiceNinjaPayment({ env: { DB_USERNAME: 'u', DB_PASSWORD: 'p', DB_DATABASE: 'd' }, execFileImpl: async () => ({ stdout: seeded, stderr: '' }) });
  assert.equal(result.passed, true); assert.equal(result.authority, 'independent-database'); assert.equal(result.oracle, 'invoiceninja-database-payment');
});

test('rejects wrong payment status, amount, applied/refunded flags, deletion, and multiplicity', async () => {
  const variants = [seeded.replace('\t4\t', '\t2\t'), seeded.replace('120000.000000', '1.000000'), seeded.replace('\t0.000000\t120000', '\t1.000000\t120000'), seeded.replace(/\t0\n$/, '\t1\n'), `${seeded}${seeded}`];
  for (const stdout of variants) assert.equal((await evaluateInvoiceNinjaPayment({ env: { DB_USERNAME: 'u', DB_PASSWORD: 'p', DB_DATABASE: 'd' }, execFileImpl: async () => ({ stdout, stderr: '' }) })).passed, false);
});

test('payment lookup is exact and SQL escapes literals', () => {
  assert.match(buildInvoiceNinjaPaymentsSql(), /FROM payments/); assert.match(buildInvoiceNinjaPaymentsSql({ paymentNumber: "1' OR '1'='1" }), /'1\\' OR \\'1\\'=\\'1'/);
});

test('missing payment database password fails closed', async () => {
  const result = await evaluateInvoiceNinjaPayment({ env: {}, envFile: '/nonexistent/invoiceninja/.env', execFileImpl: async () => ({ stdout: seeded, stderr: '' }) });
  assert.equal(result.passed, false); assert.match(result.error.message, /password is missing/);
});

test('explicit payment oracle configuration overrides profile values', () => {
  const config = resolveInvoiceNinjaPaymentsDbConfig({ env: { PSS_INVOICENINJA_DB_CONTAINER: 'custom', DB_USERNAME: 'u', DB_PASSWORD: 'p', DB_DATABASE: 'd' } });
  assert.deepEqual(config, { container: 'custom', database: 'd', username: 'u', password: 'p' });
});
