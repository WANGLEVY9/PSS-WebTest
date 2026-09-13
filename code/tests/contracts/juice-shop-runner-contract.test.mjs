import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const hybridRunner = fs.readFileSync(new URL('../../scripts/run-volcengine-juice-hybrid-smoke.mjs', import.meta.url), 'utf8');
const visualRunner = fs.readFileSync(new URL('../../scripts/run-volcengine-juice-visual-smoke.mjs', import.meta.url), 'utf8');
const matchedRunner = fs.readFileSync(new URL('../../scripts/juice-shop-matched-pilot.mjs', import.meta.url), 'utf8');

test('Juice Shop hybrid runner forwards the resolved semantic action mode to the driver', () => {
  assert.match(hybridRunner, /const hybridActionMode = process\.env\.CUA_HYBRID_ACTION_MODE \?\? optimization\.hybrid_action_mode/);
  assert.match(hybridRunner, /createVolcengineHybridDriver\(\{[\s\S]*?hybridActionMode,/);
});

test('Juice Shop basket lane uses the cross-page-state budget and task-specific run mode', () => {
  assert.match(visualRunner, /taskId === 'juice-shop-add-to-basket' \? 'cross-page-state'/);
  assert.match(hybridRunner, /taskId === 'juice-shop-add-to-basket' \? 'cross-page-state'/);
  assert.match(matchedRunner, /taskId === 'juice-shop-add-to-basket' \? 'cross-page-state'/);
});
