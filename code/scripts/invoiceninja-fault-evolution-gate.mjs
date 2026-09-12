import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { chromium } from 'playwright';
import { evaluateInvoiceNinjaInvoice } from '../src/invoiceninja-oracle.mjs';
import { installInvoiceNinjaMutation } from '../src/mutations/invoiceninja.mjs';

const envFile = process.env.PSS_INVOICENINJA_ENV ?? new URL('../../third_party/WebTestPilot/webapps/invoiceninja/.env', import.meta.url).pathname;
dotenv.config({ path: envFile });
dotenv.config();
const baseURL = process.env.INVOICE_NINJA_BASE_URL ?? `http://127.0.0.1:${process.env.APP_PORT ?? '8082'}`;
const username = process.env.PSS_INVOICENINJA_USERNAME ?? process.env.IN_USER_EMAIL;
const password = process.env.PSS_INVOICENINJA_PASSWORD ?? process.env.IN_PASSWORD;
if (!username || !password) throw new Error('Invoice Ninja credentials are missing');
const outputPath = path.resolve(process.env.PSS_GATE_RESULT_OUT ?? new URL('../../results/phase2/2026-09-12-invoiceninja-fault-evolution-gate.md', import.meta.url).pathname);

async function dismissOnboarding(page) {
  await page.waitForTimeout(1000);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const overlay = page.locator('[aria-hidden="true"][data-headlessui-state="open"]');
    if (await overlay.count() === 0) return;
    const save = page.getByRole('button', { name: 'Save', exact: true });
    if (await save.isVisible().catch(() => false)) await save.click().catch(() => {});
    else await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(250);
  }
}

async function runVariant({ mutationId = null } = {}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await installInvoiceNinjaMutation(page, mutationId);
  await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="email"]').fill(username);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await dismissOnboarding(page);
  await page.getByRole('link', { name: 'Invoices', exact: true }).click();
  await page.getByRole('link', { name: '123456', exact: true }).click();
  await page.waitForTimeout(250);
  const bodyText = await page.locator('body').innerText();
  const visibleInvoiceValues = await page.locator('input:visible').evaluateAll((inputs) => inputs.map((input) => input.value).filter(Boolean));
  const result = {
    mutation_id: mutationId,
    url_path: new URL(page.url()).pathname,
    edit_heading_visible: await page.getByRole('heading', { name: 'Edit Invoice', exact: true }).isVisible().catch(() => false),
    invoice_number_visible: visibleInvoiceValues.includes('999999') || bodyText.includes('999999') ? '999999' : visibleInvoiceValues.includes('123456') || bodyText.includes('123456') ? '123456' : null,
    mutation_marker_visible: await page.locator('#pss-invoiceninja-number-mismatch').count() > 0,
    layout_marker_visible: await page.locator('#pss-invoiceninja-layout-v1').count() > 0,
    oracle: await evaluateInvoiceNinjaInvoice()
  };
  await browser.close();
  return result;
}

const results = {
  baseline: await runVariant(),
  fault_applied: await runVariant({ mutationId: 'invoiceninja-visible-number-mismatch' }),
  fault_removed: await runVariant(),
  evolution_applied: await runVariant({ mutationId: 'invoiceninja-layout-v1' }),
  evolution_removed: await runVariant()
};

const checks = {
  fault_applied_visible_mismatch: results.fault_applied.invoice_number_visible === '999999',
  fault_db_unchanged: results.baseline.oracle.passed === true && results.fault_applied.oracle.passed === true && results.fault_removed.oracle.passed === true,
  fault_removed_restores_clean: results.fault_removed.invoice_number_visible === '123456' && results.fault_removed.mutation_marker_visible === false,
  evolution_applied_marker: results.evolution_applied.layout_marker_visible === true,
  evolution_semantics_preserved: results.evolution_applied.invoice_number_visible === '123456' && results.evolution_applied.edit_heading_visible === true && results.evolution_applied.oracle.passed === true,
  evolution_removed_isolated: results.evolution_removed.layout_marker_visible === false && results.evolution_removed.invoice_number_visible === '123456'
};
const passed = Object.values(checks).every(Boolean);
const lines = [
  '# Invoice Ninja fault/evolution apply-remove-isolation gate (2026-09-12)',
  '',
  'Evidence boundary: mutation preflight only; no agent arm was run and Invoice Ninja remains non-admitted.',
  '',
  '| Variant | URL | visible number | edit heading | DB oracle | fault marker | layout marker |',
  '|---|---|---:|---:|---:|---:|---:|',
  ...Object.entries(results).map(([name, row]) => `| ${name} | ${row.url_path} | ${row.invoice_number_visible ?? 'unknown'} | ${row.edit_heading_visible ? 'yes' : 'no'} | ${row.oracle.passed ? 'pass' : 'fail'} | ${row.mutation_marker_visible ? 'yes' : 'no'} | ${row.layout_marker_visible ? 'yes' : 'no'} |`),
  '',
  '## Checks',
  '',
  ...Object.entries(checks).map(([name, value]) => `- ${name}: **${value ? 'pass' : 'fail'}**`),
  '',
  `Gate result: **${passed ? 'PASS' : 'FAIL'}**`,
  '',
  'A PASS is a prerequisite for fault/evolution arm runs only. It does not admit the application, freeze repetitions, or justify confirmatory analysis.'
];
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
console.log(JSON.stringify({ application: 'invoiceninja', gate: 'fault-evolution-apply-remove-isolation', passed, checks, output: outputPath }, null, 2));
if (!passed) process.exitCode = 1;
