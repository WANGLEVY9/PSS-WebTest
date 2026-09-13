import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INVOICENINJA_DEFAULT_EXPECTED,
  evaluateInvoiceNinjaInvoice,
  judgeInvoiceRows,
  loadInvoiceNinjaDbConfig
} from '../../src/invoiceninja-oracle.mjs';

const paidRow = { id: 1, client_id: 1, number: '123456', amount: 120000, balance: 0, status_id: 4, is_deleted: 0 };

test('accepts the seeded paid invoice row', () => {
  const judged = judgeInvoiceRows([paidRow], INVOICENINJA_DEFAULT_EXPECTED);
  assert.equal(judged.passed, true);
  assert.deepEqual(judged.reasons, []);
});

test('rejects a wrong status, amount, balance, soft delete or row count', () => {
  assert.equal(judgeInvoiceRows([{ ...paidRow, status_id: 2 }], INVOICENINJA_DEFAULT_EXPECTED).passed, false);
  assert.equal(judgeInvoiceRows([{ ...paidRow, amount: 60000 }], INVOICENINJA_DEFAULT_EXPECTED).passed, false);
  assert.equal(judgeInvoiceRows([{ ...paidRow, balance: 60000 }], INVOICENINJA_DEFAULT_EXPECTED).passed, false);
  assert.equal(judgeInvoiceRows([{ ...paidRow, is_deleted: 1 }], INVOICENINJA_DEFAULT_EXPECTED).passed, false);
  assert.equal(judgeInvoiceRows([], INVOICENINJA_DEFAULT_EXPECTED).passed, false);
  assert.equal(judgeInvoiceRows([paidRow, paidRow], INVOICENINJA_DEFAULT_EXPECTED).passed, false);
});

test('the oracle queries the persisted database and never the visible page', async () => {
  const calls = [];
  const execFileImpl = async (command, args) => {
    calls.push({ command, args });
    return { stdout: '1\t1\t123456\t120000.000000\t0.000000\t4\t0\n', stderr: '' };
  };
  const result = await evaluateInvoiceNinjaInvoice({
    env: { DB_USERNAME: 'u', DB_PASSWORD: 'p', DB_DATABASE: 'd' },
    execFileImpl
  });
  assert.equal(result.passed, true);
  assert.equal(result.authority, 'independent-database');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, 'docker');
  const sql = calls[0].args.at(-1);
  assert.match(sql, /FROM invoices/);
  // An exact match is required: LIKE '123456' would also match 123456_sent,
  // 123456_draft and 123456_past_due.
  assert.match(sql, /number = '123456'/);
  assert.doesNotMatch(sql, /LIKE/);
});

test('escapes the invoice number instead of interpolating raw input', async () => {
  let captured = null;
  await evaluateInvoiceNinjaInvoice({
    env: { DB_USERNAME: 'u', DB_PASSWORD: 'p', DB_DATABASE: 'd' },
    invoiceNumber: "1' OR '1'='1",
    execFileImpl: async (command, args) => { captured = args.at(-1); return { stdout: '', stderr: '' }; }
  });
  assert.match(captured, /'1'' OR ''1''=''1'/);
});

test('a database error is reported as a failed oracle, not as a passed cell', async () => {
  const result = await evaluateInvoiceNinjaInvoice({
    env: { DB_USERNAME: 'u', DB_PASSWORD: 'p', DB_DATABASE: 'd' },
    execFileImpl: async () => { throw new Error('container is not running'); }
  });
  assert.equal(result.passed, false);
  assert.equal(result.error.message, 'container is not running');
});

test('missing database credentials fail closed', async () => {
  // The oracle normally falls back to the local WebTestPilot profile file, so
  // this test points at a missing file to exercise the fail-closed path.
  const result = await evaluateInvoiceNinjaInvoice({
    env: {},
    envFile: '/nonexistent/invoiceninja/.env',
    execFileImpl: async () => ({ stdout: '', stderr: '' })
  });
  assert.equal(result.passed, false);
  assert.match(result.error.message, /credentials are not available/);
});

test('db config prefers explicit environment over the profile file', () => {
  const config = loadInvoiceNinjaDbConfig({ env: { DB_USERNAME: 'explicit', PSS_INVOICENINJA_DB_CONTAINER: 'custom-db' } });
  assert.equal(config.user, 'explicit');
  assert.equal(config.container, 'custom-db');
});
