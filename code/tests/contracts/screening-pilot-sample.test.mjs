import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScreeningPilotSample } from '../../scripts/export-screening-pilot-sample.mjs';

const candidate = (id, benchmark = 'b', sites = ['site']) => ({
  benchmark_id: benchmark,
  source_commit: 'c'.repeat(40),
  task_source_id: id,
  instruction_digest: id.padEnd(64, '0').slice(0, 64),
  sites,
  start_url_count: 1,
  require_login: false,
  difficulty: null,
  source_file: 'official.json'
});

test('screening pilot sample is deterministic and stratified', () => {
  const inventory = { status: 'source-inventory-only-screening-pending', confirmatory_authorized: false, candidates: [
    ...Array.from({ length: 10 }, (_, i) => candidate(`a${i}`)),
    ...Array.from({ length: 5 }, (_, i) => candidate(`b${i}`, 'b', ['other']))
  ] };
  const first = buildScreeningPilotSample(inventory, { sampleFraction: 0.2, randomSeed: 7 });
  const second = buildScreeningPilotSample(inventory, { sampleFraction: 0.2, randomSeed: 7 });
  assert.deepEqual(first.candidates, second.candidates);
  assert.equal(first.sample_count, 3);
  assert.equal(first.strata['b|site'].selected, 2);
  assert.equal(first.strata['b|other'].selected, 1);
  assert.equal(first.confirmatory_authorized, false);
});

test('screening pilot sample contains only outcome-blind candidate fields', () => {
  const inventory = { status: 'source-inventory-only-screening-pending', confirmatory_authorized: false, candidates: [candidate('a')] };
  const output = buildScreeningPilotSample(inventory, { sampleFraction: 1, randomSeed: 1 });
  assert.deepEqual(Object.keys(output.candidates[0]).sort(), ['benchmark_id', 'difficulty', 'instruction_digest', 'require_login', 'sites', 'source_commit', 'source_file', 'start_url_count', 'task_source_id']);
  assert.equal(Object.hasOwn(output.candidates[0], 'status'), false);
});
