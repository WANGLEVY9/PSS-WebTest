import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import dotenv from 'dotenv';

const execFileAsync = promisify(execFile);
const defaultEnvFile = path.resolve(fileURLToPath(new URL('../../third_party/WebTestPilot/webapps/invoiceninja/.env', import.meta.url)));

/**
 * Invoice Ninja independent oracle.
 *
 * Authority is the persisted application database, not the visible page and not
 * the arm's self-report. The oracle is evaluated after the arm stops and its
 * result is never fed back to the agent.
 */

export const INVOICENINJA_DEFAULT_INVOICE_NUMBER = '123456';
// Seeded invoice 123456 is a fully paid invoice: status_id 4 (paid) with a zero
// balance and an amount of 120000. The sibling rows 123456_sent, 123456_draft
// and 123456_past_due exist so an exact-number lookup cannot accidentally match
// a different state.
export const INVOICENINJA_DEFAULT_EXPECTED = Object.freeze({ status_id: 4, amount: 120000, balance: 0 });

export function loadInvoiceNinjaDbConfig({ env = process.env, envFile = defaultEnvFile } = {}) {
  const fileVars = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
  const merged = { ...fileVars, ...env };
  return {
    container: merged.PSS_INVOICENINJA_DB_CONTAINER ?? 'invoiceninja-mysql-1',
    user: merged.DB_USERNAME ?? null,
    password: merged.DB_PASSWORD ?? null,
    database: merged.DB_DATABASE ?? null
  };
}

function escapeLiteral(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll("'", "''");
}

export async function queryInvoiceRows({ config, invoiceNumber, execFileImpl = execFileAsync }) {
  const sql = `SELECT id, client_id, number, amount, balance, status_id, is_deleted FROM invoices WHERE number = '${escapeLiteral(invoiceNumber)}' ORDER BY id;`;
  const { stdout } = await execFileImpl('docker', [
    'exec', config.container, 'mysql', '-N',
    '-u', config.user, `-p${config.password}`, config.database,
    '-e', sql
  ], { maxBuffer: 1024 * 1024 });
  return stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => {
    const [id, client_id, number, amount, balance, status_id, is_deleted] = line.split('\t');
    return {
      id: Number(id),
      client_id: Number(client_id),
      number,
      amount: Number(amount),
      balance: Number(balance),
      status_id: Number(status_id),
      is_deleted: Number(is_deleted)
    };
  }).filter((row) => Number.isInteger(row.id) && row.number);
}

export function judgeInvoiceRows(rows, expected = INVOICENINJA_DEFAULT_EXPECTED) {
  const reasons = [];
  if (rows.length !== 1) reasons.push(`expected exactly one invoice row, observed ${rows.length}`);
  const row = rows[0] ?? null;
  if (row) {
    if (row.is_deleted !== 0) reasons.push(`invoice is soft-deleted (is_deleted=${row.is_deleted})`);
    if (expected.status_id !== undefined && row.status_id !== expected.status_id) reasons.push(`status_id ${row.status_id} != expected ${expected.status_id}`);
    if (expected.amount !== undefined && row.amount !== expected.amount) reasons.push(`amount ${row.amount} != expected ${expected.amount}`);
    if (expected.balance !== undefined && row.balance !== expected.balance) reasons.push(`balance ${row.balance} != expected ${expected.balance}`);
  }
  return { passed: reasons.length === 0, reasons, row };
}

export async function evaluateInvoiceNinjaInvoice({
  env = process.env,
  envFile = defaultEnvFile,
  invoiceNumber = INVOICENINJA_DEFAULT_INVOICE_NUMBER,
  expected = INVOICENINJA_DEFAULT_EXPECTED,
  execFileImpl = execFileAsync
} = {}) {
  const evaluatedAt = new Date().toISOString();
  let config;
  try {
    config = loadInvoiceNinjaDbConfig({ env, envFile });
    if (!config.user || !config.password || !config.database) throw new Error('Invoice Ninja database credentials are not available');
    const rows = await queryInvoiceRows({ config, invoiceNumber, execFileImpl });
    const judged = judgeInvoiceRows(rows, expected);
    return {
      application: 'invoiceninja',
      oracle: 'invoiceninja-database-invoice',
      authority: 'independent-database',
      invoice_number: invoiceNumber,
      expected,
      observed_rows: rows,
      passed: judged.passed,
      reasons: judged.reasons,
      error: null,
      evaluated_at: evaluatedAt
    };
  } catch (error) {
    return {
      application: 'invoiceninja',
      oracle: 'invoiceninja-database-invoice',
      authority: 'independent-database',
      invoice_number: invoiceNumber,
      expected,
      observed_rows: [],
      passed: false,
      reasons: [],
      error: { name: error.name, message: String(error.message).slice(0, 300) },
      evaluated_at: evaluatedAt
    };
  }
}
