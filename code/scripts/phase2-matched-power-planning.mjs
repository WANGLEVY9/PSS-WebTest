#!/usr/bin/env node
// Matched-block power planning for the Phase 2 pilot input. The output is a
// sensitivity/planning artifact only: it never freezes repetitions and never
// authorizes confirmatory collection.
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (flag, fallback = null) => {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const inputPath = arg('--input');
const outputPath = arg('--output');
const draws = Number.parseInt(arg('--draws', '2000'), 10);
const seed = Number.parseInt(arg('--seed', '20260913'), 10);
const applicationFilter = arg('--application');
if (!inputPath || !outputPath) throw new Error('usage: node scripts/phase2-matched-power-planning.mjs --input input.json --output output.json');
if (!Number.isInteger(draws) || draws < 100) throw new Error('draws must be an integer >= 100');

let state = seed >>> 0;
const rand = () => ((state = (Math.imul(state ^ (state >>> 15), 2246822507) + 3266489909) >>> 0) / 0x100000000);
const normal = () => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand());
const erf = (x) => {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t) - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 1.0) * Math.exp(-ax * ax);
  return sign * y;
};
const cdf = (z) => 0.5 * (1 + erf(z / Math.sqrt(2)));
const betaSample = (a, b) => {
  // Johnk's method is adequate for the small, positive pilot posterior shapes
  // used here and keeps the planner dependency-free.
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const x = Math.pow(rand(), 1 / a);
    const y = Math.pow(rand(), 1 / b);
    if (x + y <= 1) return x / (x + y);
  }
  return a / (a + b);
};
const binomial = (n, p) => {
  let successes = 0;
  for (let i = 0; i < n; i += 1) if (rand() < p) successes += 1;
  return successes;
};

const input = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
if (input.status !== 'pilot-input-planning-only' || input.confirmatory_authorized !== false) throw new Error('input is not a fail-closed pilot input');
const eligible = (input.matched_blocks ?? []).filter((block) => block.eligible && (!applicationFilter || block.application_id === applicationFilter));
const modelGroups = new Map();
for (const block of eligible) {
  const key = `${block.provider_id}|${block.model_id}|${block.execution_variant ?? 'unknown'}`;
  const group = modelGroups.get(key) ?? { provider_id: block.provider_id, model_id: block.model_id, execution_variant: block.execution_variant ?? 'unknown', blocks: [] };
  group.blocks.push(block);
  modelGroups.set(key, group);
}
const repetitionsGrid = [4, 6, 8, 10, 14, 20];
const contrasts = [['playwright', 'visual'], ['playwright', 'hybrid'], ['hybrid', 'visual']];
function pilotRate(block, arm) {
  const row = block.arms[arm];
  return { n: row.n, successes: row.strict_passes, rate: row.n ? row.strict_passes / row.n : null };
}
function simulateContrast(blocks, reference, comparator, repetitions) {
  let rejects = 0;
  for (let draw = 0; draw < draws; draw += 1) {
    let refSuccesses = 0;
    let cmpSuccesses = 0;
    let refTrials = 0;
    let cmpTrials = 0;
    for (const block of blocks) {
      const refPilot = pilotRate(block, reference);
      const cmpPilot = pilotRate(block, comparator);
      // Independent beta posteriors are used per matched block. This preserves
      // application/workflow/condition heterogeneity instead of pooling all
      // executions into one optimistic Bernoulli rate.
      const refRate = betaSample(refPilot.successes + 1, refPilot.n - refPilot.successes + 1);
      const cmpRate = betaSample(cmpPilot.successes + 1, cmpPilot.n - cmpPilot.successes + 1);
      refSuccesses += binomial(repetitions, refRate);
      cmpSuccesses += binomial(repetitions, cmpRate);
      refTrials += repetitions;
      cmpTrials += repetitions;
    }
    const refRate = refSuccesses / refTrials;
    const cmpRate = cmpSuccesses / cmpTrials;
    const pooled = (refSuccesses + cmpSuccesses) / (refTrials + cmpTrials);
    const se = Math.sqrt(Math.max(pooled * (1 - pooled) * (1 / refTrials + 1 / cmpTrials), 1e-12));
    const pValue = 2 * (1 - cdf(Math.abs((refRate - cmpRate) / se)));
    if (pValue < 0.05) rejects += 1;
  }
  return rejects / draws;
}

const groups = [...modelGroups.values()].sort((left, right) => `${left.provider_id}|${left.model_id}|${left.execution_variant}`.localeCompare(`${right.provider_id}|${right.model_id}|${right.execution_variant}`));
const modelResults = groups.map((group) => ({
  provider_id: group.provider_id,
  model_id: group.model_id,
  execution_variant: group.execution_variant,
  application_filter: applicationFilter,
  eligible_blocks: group.blocks.length,
  applications: [...new Set(group.blocks.map((block) => block.application_id))].sort(),
  pilot_rates_by_arm: Object.fromEntries(['playwright', 'visual', 'hybrid'].map((arm) => {
    const rows = group.blocks.map((block) => pilotRate(block, arm));
    const n = rows.reduce((sum, row) => sum + row.n, 0);
    const successes = rows.reduce((sum, row) => sum + row.successes, 0);
    return [arm, { n, successes, rate: n ? successes / n : null }];
  })),
  power: repetitionsGrid.map((perCellRepetitions) => ({
    per_cell_repetitions: perCellRepetitions,
    contrasts: Object.fromEntries(contrasts.map(([reference, comparator]) => [
      `${reference}-${comparator}`, Number(simulateContrast(group.blocks, reference, comparator, perCellRepetitions).toFixed(3))
    ]))
  }))
}));

const result = {
  schema_version: 'phase2-matched-power-planning-v0.1',
  generated_at: new Date().toISOString(),
  status: 'planning-only-not-frozen',
  confirmatory_authorized: false,
  input_path: path.resolve(inputPath),
  application_filter: applicationFilter,
  draws,
  seed,
  eligible_blocks: eligible.length,
  model_strata: modelResults,
  notes: [
    'Each model is simulated separately; provider/model/framework strata are not silently pooled.',
    'Each matched block samples independent beta posteriors from its pilot counts, then generates equal repetitions for all three arms.',
    'The grid is a sensitivity analysis. It does not select or freeze the final repetition count.',
    'A final power freeze requires preregistration, complete application gates, and a reviewed analysis script hash.'
  ]
};
fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ status: 'ok', model_strata: modelResults.length, eligible_blocks: eligible.length, draws, output: outputPath }));
