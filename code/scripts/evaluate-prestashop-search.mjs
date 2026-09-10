import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const query = process.env.PSS_PRESTASHOP_QUERY ?? 'Mug';
const expectedName = process.env.PSS_PRESTASHOP_EXPECTED_PRODUCT ?? 'Mug The adventure begins';
const container = process.env.PSS_PRESTASHOP_DB_CONTAINER ?? 'prestashop-db-1';
const escapedQuery = query.replaceAll("'", "''");
const sql = `SELECT id_product,name FROM ps_product_lang WHERE id_lang=1 AND name LIKE '%${escapedQuery}%' ORDER BY id_product;`;

let stdout = '';
let error = null;
try {
  ({ stdout } = await execFileAsync('docker', ['exec', container, 'mysql', '-N', '-u', 'root', '-proot', 'prestashop', '-e', sql], { maxBuffer: 1024 * 1024 }));
} catch (caught) {
  error = { name: caught.name, message: String(caught.message).slice(0, 280) };
}

const rows = stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => {
  const [id_product, ...nameParts] = line.split('\t');
  return { id_product: Number(id_product), name: nameParts.join('\t') };
}).filter((row) => Number.isInteger(row.id_product) && row.name);
const passed = !error && rows.some((row) => row.name === expectedName);
const result = {
  application: 'prestashop',
  oracle: 'database-product-search',
  query,
  expected_name: expectedName,
  observed_rows: rows,
  passed,
  error,
  evaluated_at: new Date().toISOString()
};
console.log(JSON.stringify(result));
if (!passed) process.exitCode = 1;
