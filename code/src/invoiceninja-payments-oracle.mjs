import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import dotenv from 'dotenv';

const execFileAsync = promisify(execFile);
const defaultEnvFile = path.resolve(new URL('../../third_party/WebTestPilot/webapps/invoiceninja/.env', import.meta.url).pathname);
export const INVOICENINJA_DEFAULT_PAYMENT_NUMBER = '0001';
export const INVOICENINJA_DEFAULT_PAYMENT_EXPECTED = Object.freeze({ status_id: 4, amount: 120000, refunded: 0, applied: 120000 });

function readEnv(file) {
  return fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file, 'utf8')) : {};
}

export function resolveInvoiceNinjaPaymentsDbConfig({ env = process.env, envFile = defaultEnvFile } = {}) {
  const profile = readEnv(envFile);
  const merged = { ...profile, ...env };
  return {
    container: merged.PSS_INVOICENINJA_DB_CONTAINER ?? 'invoiceninja-mysql-1',
    database: merged.PSS_INVOICENINJA_DB_NAME ?? merged.DB_DATABASE ?? 'ninja',
    username: merged.PSS_INVOICENINJA_DB_USER ?? merged.DB_USERNAME ?? 'ninja',
    password: merged.PSS_INVOICENINJA_DB_PASSWORD ?? merged.DB_PASSWORD ?? ''
  };
}

export function buildInvoiceNinjaPaymentsSql({ paymentNumber = INVOICENINJA_DEFAULT_PAYMENT_NUMBER } = {}) {
  const escaped = String(paymentNumber).replaceAll('\\', '\\\\').replaceAll("'", "\\'");
  return `SELECT id, client_id, status_id, amount, refunded, applied, date, number, is_deleted FROM payments WHERE number = '${escaped}' ORDER BY id;`;
}

export async function queryInvoiceNinjaPaymentRows({ config = resolveInvoiceNinjaPaymentsDbConfig(), paymentNumber = INVOICENINJA_DEFAULT_PAYMENT_NUMBER, execFileImpl = execFileAsync } = {}) {
  if (!config.password) throw new Error('Invoice Ninja payment oracle database password is missing');
  const sql = buildInvoiceNinjaPaymentsSql({ paymentNumber });
  const { stdout } = await execFileImpl('docker', ['exec', '-i', config.container, 'mysql', '-N', '-B', '-u', config.username, `-p${config.password}`, config.database, '-e', sql], { maxBuffer: 1024 * 1024 });
  return String(stdout).trim().split(/\r?\n/).filter(Boolean).map((line) => {
    const [id, client_id, status_id, amount, refunded, applied, date, number, is_deleted] = line.split('\t');
    return { id: Number(id), client_id: Number(client_id), status_id: Number(status_id), amount: Number(amount), refunded: Number(refunded), applied: Number(applied), date, number, is_deleted: Number(is_deleted) };
  });
}

export async function evaluateInvoiceNinjaPayment({ env = process.env, envFile = defaultEnvFile, paymentNumber = INVOICENINJA_DEFAULT_PAYMENT_NUMBER, expected = INVOICENINJA_DEFAULT_PAYMENT_EXPECTED, config, execFileImpl } = {}) {
  try {
    const resolvedConfig = config ?? resolveInvoiceNinjaPaymentsDbConfig({ env, envFile });
    const observedRows = await queryInvoiceNinjaPaymentRows({ config: resolvedConfig, paymentNumber, execFileImpl });
    const reasons = [];
    if (observedRows.length !== 1) reasons.push(`expected exactly one payment row, observed ${observedRows.length}`);
    const row = observedRows[0];
    for (const field of ['status_id', 'amount', 'refunded', 'applied']) if (row && row[field] !== expected[field]) reasons.push(`${field}=${row[field]} expected ${expected[field]}`);
    if (row && row.is_deleted !== 0) reasons.push(`payment is soft-deleted (is_deleted=${row.is_deleted})`);
    return { application: 'invoiceninja', oracle: 'invoiceninja-database-payment', authority: 'independent-database', payment_number: paymentNumber, expected, observed_rows: observedRows, passed: reasons.length === 0, reasons, error: null, evaluated_at: new Date().toISOString() };
  } catch (error) {
    return { application: 'invoiceninja', oracle: 'invoiceninja-database-payment', authority: 'independent-database', payment_number: paymentNumber, expected, observed_rows: [], passed: false, reasons: [], error: { name: error.name, message: String(error.message).slice(0, 240) }, evaluated_at: new Date().toISOString() };
  }
}
