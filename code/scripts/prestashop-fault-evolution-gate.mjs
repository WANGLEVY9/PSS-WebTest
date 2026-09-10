import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import { applyPrestashopMutation, listPrestashopMutations } from '../src/prestashop-mutations.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

dotenv.config({ path: process.env.PSS_PRESTASHOP_ENV ?? new URL('../../third_party/WebTestPilot/webapps/prestashop/.env', import.meta.url).pathname });
const execFileAsync = promisify(execFile);
const baseURL = process.env.PRESTASHOP_BASE_URL ?? 'http://localhost:8083';
const query = process.env.PSS_PRESTASHOP_QUERY ?? 'Mug';
const targetText = process.env.PSS_PRESTASHOP_TARGET_PRODUCT ?? 'Pack Mug + Framed poster';
const dbContainer = process.env.PSS_PRESTASHOP_DB_CONTAINER ?? 'prestashop-db-1';
const outputPath = path.resolve(process.env.PSS_GATE_RESULT_OUT ?? path.resolve(new URL('../../results/phase2/2026-09-10-prestashop-fault-evolution-gate.md', import.meta.url).pathname));

async function dbSnapshot() {
  const sql = `SELECT id_product,name FROM ps_product_lang WHERE id_lang=1 AND (name='${targetText.replaceAll("'", "''")}' OR name='Framed Poster') ORDER BY id_product;`;
  const { stdout } = await execFileAsync('docker', ['exec', dbContainer, 'mysql', '-N', '-u', 'root', '-proot', 'prestashop', '-e', sql], { maxBuffer: 1024 * 1024 });
  return stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => {
    const [id_product, ...name] = line.split('\t');
    return { id_product: Number(id_product), name: name.join('\t') };
  });
}

async function pageState(page) {
  return page.evaluate(({ targetText }) => ({
    url_path: location.pathname,
    heading_visible: [...document.querySelectorAll('h1,h2,h3')].some((node) => node.textContent.trim() === 'Search results'),
    target_visible: [...document.querySelectorAll('.product-description .product-title a')].some((node) => node.textContent.trim() === targetText),
    replacement_visible: [...document.querySelectorAll('.product-description .product-title a')].some((node) => node.textContent.trim() === 'Framed Poster'),
    product_count: document.querySelectorAll('#js-product-list .js-product').length,
    mutation_marker: document.documentElement.dataset.pssMutation ?? null,
    style_marker: Boolean(document.querySelector('#pss-webtest-search-layout-preserving-v1'))
  }), { targetText });
}

const startedAt = Date.now();
const results = [];
let dbBefore = null;
let dbAfter = null;
let infrastructureError = null;
const browser = await chromium.launch({ headless: true });
try {
  dbBefore = await dbSnapshot();
  for (const definition of listPrestashopMutations()) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    const row = { mutation_id: definition.id, condition: definition.condition, baseline: null, applied: null, removed: null, isolated: null, passed: false };
    try {
      await page.goto(`${baseURL}/search?s=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
      await page.locator('#js-product-list .js-product').first().waitFor({ state: 'visible', timeout: 15000 });
      row.baseline = await pageState(page);
      const applied = await applyPrestashopMutation(page, definition.id);
      row.applied = { controller: applied, state: await pageState(page) };
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('#js-product-list .js-product').first().waitFor({ state: 'visible', timeout: 15000 });
      row.removed = await pageState(page);
      const isolatedContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const isolatedPage = await isolatedContext.newPage();
      await isolatedPage.goto(`${baseURL}/search?s=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded' });
      await isolatedPage.locator('#js-product-list .js-product').first().waitFor({ state: 'visible', timeout: 15000 });
      row.isolated = await pageState(isolatedPage);
      await isolatedContext.close();
      if (definition.condition === 'functional-fault') {
        row.passed = row.baseline.target_visible === true && row.applied.controller.applied === true && row.applied.state.target_visible === false && row.applied.state.replacement_visible === true && row.removed.target_visible === true && row.isolated.target_visible === true;
      } else {
        row.passed = row.baseline.target_visible === true && row.applied.controller.applied === true && row.applied.state.target_visible === true && row.applied.state.product_count === row.baseline.product_count && row.applied.state.style_marker === true && row.removed.target_visible === true && row.isolated.target_visible === true;
      }
    } catch (error) {
      row.error = { name: error.name, message: error.message.slice(0, 240) };
    } finally {
      await context.close();
    }
    results.push(row);
  }
  dbAfter = await dbSnapshot();
} catch (error) {
  infrastructureError = { name: error.name, message: error.message.slice(0, 300) };
} finally {
  await browser.close();
}

const dbUnchanged = dbBefore && dbAfter && JSON.stringify(dbBefore) === JSON.stringify(dbAfter);
const passed = !infrastructureError && dbUnchanged === true && results.length === listPrestashopMutations().length && results.every((result) => result.passed);
const report = [
  '# PrestaShop fault/evolution apply-remove-isolation gate (2026-09-10)', '',
  `- **Gate status:** ${passed ? 'PASS' : 'FAIL/CLOSED'}`,
  '- **Evidence class:** platform/condition diagnostic; not a three-arm matched pilot or confirmatory result.',
  `- **Base URL:** \`${baseURL}\``,
  `- **Mutations exercised:** ${results.length}/${listPrestashopMutations().length}`,
  `- **Independent database oracle unchanged:** ${dbUnchanged === true ? 'yes' : 'no/unknown'}`,
  `- **Infrastructure error:** ${infrastructureError ? JSON.stringify(infrastructureError) : 'none'}`, '',
  '| Mutation | Condition | Baseline target | Applied state | Removed target | Isolated target | Result |',
  '|---|---|---:|---|---:|---:|---|',
  ...results.map((result) => `| ${result.mutation_id} | ${result.condition} | ${result.baseline?.target_visible ?? 'unknown'} | ${result.applied?.state ? `target=${result.applied.state.target_visible}, replacement=${result.applied.state.replacement_visible}, count=${result.applied.state.product_count}` : 'unknown'} | ${result.removed?.target_visible ?? 'unknown'} | ${result.isolated?.target_visible ?? 'unknown'} | ${result.passed ? 'pass' : 'fail'} |`), '',
  `- **Database rows before:** ${JSON.stringify(dbBefore)}`,
  `- **Database rows after:** ${JSON.stringify(dbAfter)}`,
  `- **Wall time:** ${Date.now() - startedAt} ms`, '',
  'A PASS is only a prerequisite for later arm-specific fault/evolution runs. It does not admit PrestaShop into the benchmark or justify repetition/power decisions.'
].join('\n') + '\n';
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, report, { mode: 0o600 });
console.log(JSON.stringify({ application: 'prestashop', gate: 'fault-evolution-apply-remove-isolation', passed, db_unchanged: dbUnchanged, results, infrastructure_error: infrastructureError, output: outputPath }));
if (!passed) process.exitCode = 1;
