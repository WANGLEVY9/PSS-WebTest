import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const codeRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (relative) => fs.readFileSync(path.join(codeRoot, relative), 'utf8');

test('PrestaShop simple agent and Playwright runners use the same benchmark task id', () => {
  const matrix = JSON.parse(read('config/benchmark-matrix.v0.1.json'));
  const app = matrix.applications.find((entry) => entry.id === 'prestashop');
  const benchmarkTask = app.workflows.find((workflow) => workflow.id === 'prestashop-buyer-search-product');
  assert.ok(benchmarkTask, 'benchmark matrix must define the PrestaShop buyer search task');

  const agentRunner = read('scripts/run-prestashop-agent-cell.mjs');
  const playwrightRunner = read('scripts/run-prestashop-playwright-cell.mjs');
  const agentTask = agentRunner.match(/taskId:\s*'([^']+)'/u)?.[1];
  const playwrightTask = playwrightRunner.match(/simple:\s*'([^']+)'/u)?.[1];
  assert.equal(agentTask, benchmarkTask.id);
  assert.equal(playwrightTask, benchmarkTask.id);
});

test('PrestaShop medium and complex Playwright runners retain the agent task mapping and replay steps', () => {
  const runner = read('scripts/run-prestashop-playwright-cell.mjs');
  assert.match(runner, /medium:\s*'prestashop-search-open-product'/u);
  assert.match(runner, /complex:\s*'prestashop-search-revisit-product'/u);
  assert.match(runner, /complexity === 'medium' \|\| complexity === 'complex'/u);
  assert.match(runner, /page\.goBack\(\{ waitUntil: 'domcontentloaded' \}\)/u);
  assert.match(runner, /product_detail_visible/u);
});
