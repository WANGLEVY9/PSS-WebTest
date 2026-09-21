import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { evaluateJuiceShopUiSearch } from '../src/oracles/juice-shop-ui-search.mjs';
import { installJuiceShopLayoutEvolution, installJuiceShopSearchOmission } from '../src/mutations/juice-shop.mjs';

const codeRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const repositoryRoot = path.resolve(codeRoot, '..');
const baseURL = process.env.JUICE_SHOP_BASE_URL ?? 'http://127.0.0.1:3000';
const query = process.env.PSS_JUICE_SHOP_QUERY ?? 'apple';
const reportPath = path.resolve(process.env.PSS_GATE_RESULT_OUT ?? path.join(repositoryRoot, 'results/phase2/2026-09-13-juice-shop-fault-evolution-gate.md'));

const run = (command, args, env = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: codeRoot, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject); child.on('close', (code) => resolve({ code, stdout, stderr }));
});

async function reset() {
  const result = await run('node', ['scripts/juice-shop-lifecycle.mjs', 'reset']);
  if (result.code !== 0) throw new Error(`Juice Shop reset failed: ${result.stderr}`);
  return result.stdout.trim().split('\n').at(-1) ?? null;
}

async function executeVariant({ mutation = null } = {}) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  let mutationEvidence = null;
  try {
    if (mutation === 'fault') mutationEvidence = await installJuiceShopSearchOmission(page);
    if (mutation === 'evolution') mutationEvidence = await installJuiceShopLayoutEvolution(page);
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    await page.locator('mat-card').first().waitFor({ state: 'visible', timeout: 15000 });
    for (const [label, text] of [['dismiss', 'Dismiss'], ['cookies', 'Me want it!']]) {
      const control = page.getByText(text, { exact: true });
      await control.waitFor({ state: 'visible', timeout: 1000 }).then(() => control.click({ force: true })).catch(() => {});
    }
    await page.getByRole('button', { name: 'Open search' }).click();
    const box = page.getByRole('textbox').first();
    await box.fill(query);
    await box.press('Enter');
    await page.waitForTimeout(400);
    const oracle = await evaluateJuiceShopUiSearch(page, { query });
    const layoutMarkerVisible = await page.locator('#pss-juice-layout-v1').count() > 0;
    return { url_path: new URL(page.url()).pathname, oracle, layout_marker_visible: layoutMarkerVisible, mutation: mutationEvidence };
  } finally {
    await context.close();
    await browser.close();
  }
}

await reset();
const baseline = await executeVariant();
await reset();
const faultApplied = await executeVariant({ mutation: 'fault' });
await reset();
const faultRemoved = await executeVariant();
await reset();
const evolutionApplied = await executeVariant({ mutation: 'evolution' });
await reset();
const evolutionRemoved = await executeVariant();

const checks = {
  baseline_clean: baseline.oracle.passed === true && baseline.layout_marker_visible === false,
  fault_positive_missing_expected: faultApplied.oracle.passed === false && faultApplied.oracle.visible_expected_names.length === 2,
  fault_removed_restores_clean: faultRemoved.oracle.passed === true && faultRemoved.layout_marker_visible === false,
  evolution_preserves_semantics: evolutionApplied.oracle.passed === true && evolutionApplied.layout_marker_visible === true,
  evolution_removed_isolated: evolutionRemoved.oracle.passed === true && evolutionRemoved.layout_marker_visible === false
};
const passed = Object.values(checks).every(Boolean);
const lines = [
  '# Juice Shop fault/evolution apply-remove-isolation gate (2026-09-13)',
  '',
  'Mutation preflight only; no agent arm was run and Juice Shop remains non-admitted.',
  '',
  '| Variant | UI oracle | expected-result count | layout marker |',
  '|---|---:|---:|---:|',
  `| baseline | ${baseline.oracle.passed ? 'pass' : 'fail'} | ${baseline.oracle.visible_expected_names.length} | ${baseline.layout_marker_visible ? 'yes' : 'no'} |`,
  `| fault applied | ${faultApplied.oracle.passed ? 'pass (unexpected)' : 'fault detected'} | ${faultApplied.oracle.visible_expected_names.length} | ${faultApplied.layout_marker_visible ? 'yes' : 'no'} |`,
  `| fault removed | ${faultRemoved.oracle.passed ? 'pass' : 'fail'} | ${faultRemoved.oracle.visible_expected_names.length} | ${faultRemoved.layout_marker_visible ? 'yes' : 'no'} |`,
  `| evolution applied | ${evolutionApplied.oracle.passed ? 'pass' : 'fail'} | ${evolutionApplied.oracle.visible_expected_names.length} | ${evolutionApplied.layout_marker_visible ? 'yes' : 'no'} |`,
  `| evolution removed | ${evolutionRemoved.oracle.passed ? 'pass' : 'fail'} | ${evolutionRemoved.oracle.visible_expected_names.length} | ${evolutionRemoved.layout_marker_visible ? 'yes' : 'no'} |`,
  '',
  '## Checks',
  '',
  ...Object.entries(checks).map(([name, value]) => `- ${name}: **${value ? 'pass' : 'fail'}**`),
  '',
  `Gate result: **${passed ? 'PASS' : 'FAIL'}**`,
  '',
  'The fault mutation is browser-context scoped and the evolution mutation is presentation-only; each reset and fresh context is executed independently.'
];
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
console.log(JSON.stringify({ application: 'juice-shop', gate: 'fault-evolution-apply-remove-isolation', passed, checks, output: reportPath }, null, 2));
if (!passed) process.exitCode = 1;

