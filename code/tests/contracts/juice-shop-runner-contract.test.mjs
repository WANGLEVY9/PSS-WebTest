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

test('Juice Shop pagination lane uses a dedicated task family, manifest, and oracle', () => {
  assert.match(visualRunner, /isPaginationTask\s*\? 'pagination-filter'/);
  assert.match(hybridRunner, /isPaginationTask\s*\? 'pagination-filter'/);
  assert.match(matchedRunner, /juice-shop-pagination-run-manifest\.v0\.1\.json/);
  assert.match(matchedRunner, /evaluate-juice-shop-pagination\.mjs/);
});

test('Juice Shop last-item pagination variant remains a separate mapped workflow', () => {
  assert.match(visualRunner, /taskId === 'juice-shop-pagination-last-item'/);
  assert.match(hybridRunner, /taskId === 'juice-shop-pagination-last-item'/);
  assert.match(matchedRunner, /juice-shop-pagination-last-item-run-manifest\.v0\.1\.json/);
  assert.match(matchedRunner, /RUN_JUICE_SHOP_PAGINATION_LAST_ITEM/);
  assert.match(matchedRunner, /OWASP Juice Shop Sticker Page/);
});

test('Juice Shop delayed basket feedback lane maps mutation, oracle, and task mode', () => {
  assert.match(visualRunner, /juice-shop-basket-feedback/);
  assert.match(hybridRunner, /juice-shop-basket-feedback/);
  assert.match(matchedRunner, /juice-shop-basket-feedback-run-manifest\.v0\.1\.json/);
  assert.match(matchedRunner, /RUN_JUICE_SHOP_BASKET_FEEDBACK/);
  assert.match(matchedRunner, /evaluate-juice-shop-basket-feedback\.mjs/);
});

test('Juice Shop pagination hybrid runner exposes a page-progress token and rejects disabled targets early', () => {
  assert.match(hybridRunner, /progressToken: `\$\{page\.url\(\)\}::\$\{paginator\}`/);
  assert.match(hybridRunner, /target\.isEnabled\(\)\.catch\(\(\) => false\)/);
});
