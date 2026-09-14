import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOutcomeBlindTaskCandidates } from '../../scripts/export-outcome-blind-task-candidates.mjs';

test('outcome-blind candidate export inventories official source records without evaluator or outcome fields', () => {
  const inventory = buildOutcomeBlindTaskCandidates();
  assert.equal(inventory.status, 'source-inventory-only-screening-pending');
  assert.equal(inventory.confirmatory_authorized, false);
  assert.equal(inventory.candidate_count, 1834);
  assert.deepEqual(inventory.candidates.reduce((counts, item) => {
    counts[item.benchmark_id] = (counts[item.benchmark_id] ?? 0) + 1;
    return counts;
  }, {}), {
    'webarena-verified': 812,
    visualwebarena: 910,
    'autonomous-tester-agent-benchmark': 112
  });
  for (const item of inventory.candidates) {
    assert.ok(!Object.hasOwn(item, 'eval'));
    assert.ok(!Object.hasOwn(item, 'expected'));
    assert.match(item.instruction_digest, /^[a-f0-9]{64}$/);
  }
});
