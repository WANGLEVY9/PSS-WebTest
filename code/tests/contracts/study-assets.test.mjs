import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('benchmark references, metric dictionary and task blueprints validate together', () => {
  const output = execFileSync(process.execPath, ['scripts/validate-study-assets.mjs'], { encoding: 'utf8' });
  assert.match(output, /Study asset validation passed: 8 references, 15 metrics, 8 task blueprints/);
});
