import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const scriptsRoot = path.resolve(process.cwd(), 'scripts');
const runners = [
  'check-provider-readiness.mjs',
  'run-prestashop-agent-cell.mjs',
  'run-prestashop-playwright-cell.mjs',
  'run-prestashop-traditional-task.mjs'
];
const canonical = '/index.php?controller=authentication';

test('PrestaShop runners use the canonical authentication controller route', () => {
  for (const runner of runners) {
    const source = fs.readFileSync(path.join(scriptsRoot, runner), 'utf8');
    assert.ok(source.includes(canonical), `${runner} must use ${canonical}`);
  }
});

test('PrestaShop batch health probe uses the canonical authentication controller route', () => {
  const source = fs.readFileSync(path.join(scriptsRoot, 'run-prestashop-agent-500-batch.mjs'), 'utf8');
  assert.ok(source.includes(canonical));
});
