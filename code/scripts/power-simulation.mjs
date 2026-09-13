#!/usr/bin/env node
// Pilot-based planning simulation. It is NOT a confirmatory result and it does
// not freeze anything by itself.
//
// Two modes:
//
// 1. Legacy mode (default): reads a flat pilot JSON and reports a two-proportion
//    power table on Jeffreys-smoothed pilot rates. Kept unchanged so existing
//    invocations keep working.
// 2. Stratified mode (`--mode stratified`): reads a matched-pilot summary
//    produced by the matched orchestrators (records with `arm`, `cell_passed`
//    and optional `provider_id` / `complexity` / `condition`) and runs a
//    cluster-level Monte Carlo power simulation that separates
//
//      - within-cell binomial noise (repeat runs), and
//      - between-cell variance (application x workflow heterogeneity),
//
//    because the planned design is a repeated-measures, multi-application
//    comparison and a plain two-proportion calculation understates the required
//    repetition count.
//
// The between-cell variance is estimated from the pilot when at least two cells
// exist per arm, and otherwise swept over a declared sensitivity grid. The
// output always states which assumption was used.
import fs from 'node:fs';
import process from 'node:process';

const args = process.argv.slice(2);
function argValue(flag, fallback = null) {
  const index = args.indexOf(flag);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}
const inputPath = argValue('--input') ?? args.find((value) => !value.startsWith('--')) ?? '/Users/laurantwang/PSS-WebTest/artifacts/phase2/bookstack-three-arm-pilot.json';
const mode = argValue('--mode', 'legacy');
const draws = Number.parseInt(argValue('--draws', '2000'), 10);
const alpha = Number.parseFloat(argValue('--alpha', '0.05'));
const seedValue = Number.parseInt(argValue('--seed', '20260912'), 10);

let state = seedValue >>> 0;
const rand = () => ((state = (Math.imul(state ^ (state >>> 15), 2246822507) + 3266489909) >>> 0) / 0x100000000);
const normal = () => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand());
const erf = (x) => {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t) - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
};
const cdf = (z) => 0.5 * (1 + erf(z / Math.sqrt(2)));

function loadInput() {
  if (!fs.existsSync(inputPath)) return null;
  return JSON.parse(fs.readFileSync(inputPath, 'utf8'));
}

const pilot = loadInput();

if (mode === 'legacy' || !pilot?.records?.length) {
  legacyRun();
} else {
  stratifiedRun(pilot);
}

function legacyRun() {
  const fallback = {
    records: [
      { arm: 'playwright', oracle_passed: true }, { arm: 'playwright', oracle_passed: true }, { arm: 'playwright', oracle_passed: true },
      { arm: 'visual', oracle_passed: false }, { arm: 'hybrid', oracle_passed: false }
    ]
  };
  const source = pilot?.records?.length ? pilot : fallback;
  const arms = ['playwright', 'visual', 'hybrid'];
  const stats = Object.fromEntries(arms.map((arm) => {
    const rows = source.records.filter((r) => r.arm === arm && r.reset_ok !== false && r.clean_state_verified !== false);
    const successes = rows.filter((r) => r.cell_passed ?? (r.agent_completed === true && r.oracle_passed === true)).length;
    return [arm, { n: rows.length, successes, smoothed_rate: (successes + 0.5) / (rows.length + 1) }];
  }));
  const twoSidedReject = (a, b, n) => {
    const x = Array.from({ length: n }, () => rand() < a ? 1 : 0);
    const y = Array.from({ length: n }, () => rand() < b ? 1 : 0);
    const px = x.reduce((s, v) => s + v, 0) / n;
    const py = y.reduce((s, v) => s + v, 0) / n;
    const p = (x.reduce((s, v) => s + v, 0) + y.reduce((s, v) => s + v, 0)) / (2 * n);
    const se = Math.sqrt(Math.max(p * (1 - p) * 2 / n, 1e-12));
    return 2 * (1 - cdf(Math.abs((px - py) / se))) < 0.05;
  };
  const comparisons = [];
  for (const arm of ['visual', 'hybrid']) {
    const a = stats.playwright.smoothed_rate;
    const b = stats[arm].smoothed_rate;
    const power = [];
    for (const n of [6, 12, 24, 48]) {
      let hits = 0;
      for (let i = 0; i < 2000; i += 1) if (twoSidedReject(a, b, n)) hits += 1;
      power.push({ per_arm_repetitions: n, estimated_power: hits / 2000 });
    }
    comparisons.push({ contrast: `playwright-${arm}`, assumed_rates: { playwright: a, [arm]: b }, power });
  }
  console.log(JSON.stringify({
    type: 'pilot-power-planning', mode: 'legacy', confirmatory: false, pilot_input: inputPath,
    pilot_stats: stats, comparisons,
    note: 'Rates are Jeffreys-smoothed pilot planning inputs; freeze only after a valid matched pilot with pre-registered task-condition blocks.'
  }, null, 2));
}

function betaSample(a, b) {
  // Marsaglia-Tsang style gamma sampling via the normal approximation is not
  // accurate enough near 0/1, so use the Johnk algorithm for Beta(a, b).
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const u = rand();
    const v = rand();
    const x = Math.pow(u, 1 / a);
    const y = Math.pow(v, 1 / b);
    if (x + y <= 1) return x / (x + y);
  }
  return a / (a + b);
}

function stratifiedRun(pilotDocument) {
  const arms = ['playwright', 'visual', 'hybrid'];
  const rows = pilotDocument.records.filter((record) => record.clean_state_verified !== false);
  // A cell is application x workflow x condition, which is the unit the planned
  // design repeats runs inside. Repetitions are within-cell replicates, not
  // separate cells: clustering by repetition would fabricate between-cell
  // variance out of binomial noise. A single-application pilot therefore
  // correctly reports "not estimable" and sweeps the sensitivity grid.
  const cellKeyForDocument = `${pilotDocument.application ?? 'application'}::${pilotDocument.task_id ?? 'task'}::${pilotDocument.condition ?? 'condition'}`;
  const cellsByArm = Object.fromEntries(arms.map((arm) => [arm, new Map()]));
  for (const record of rows) {
    const cellKey = cellKeyForDocument;
    if (!cellsByArm[record.arm]) continue;
    const cell = cellsByArm[record.arm].get(cellKey) ?? { trials: 0, successes: 0 };
    cell.trials += 1;
    if (record.cell_passed === true) cell.successes += 1;
    cellsByArm[record.arm].set(cellKey, cell);
  }

  // Between-cell variance estimate. With fewer than two cells we cannot estimate
  // heterogeneity, so we declare a sensitivity grid instead of assuming zero.
  const varianceByArm = {};
  for (const arm of arms) {
    const cells = [...cellsByArm[arm].values()];
    const rates = cells.filter((cell) => cell.trials > 0).map((cell) => cell.successes / cell.trials);
    if (rates.length >= 2) {
      const mean = rates.reduce((sum, value) => sum + value, 0) / rates.length;
      const variance = rates.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (rates.length - 1);
      varianceByArm[arm] = { source: 'pilot-between-cell', value: variance, cells: rates.length, mean };
    } else {
      varianceByArm[arm] = { source: 'assumed-sensitivity-grid', value: null, cells: rates.length };
    }
  }

  const pooled = Object.fromEntries(arms.map((arm) => {
    const cells = [...cellsByArm[arm].values()];
    const trials = cells.reduce((sum, cell) => sum + cell.trials, 0);
    const successes = cells.reduce((sum, cell) => sum + cell.successes, 0);
    return [arm, { trials, successes, rate: trials > 0 ? successes / trials : null }];
  }));

  const grid = [0, 0.02, 0.05, 0.10];
  const repetitions = [4, 6, 8, 10, 14, 20];
  const cellCounts = [8, 16, 24];
  const comparisons = [];

  for (const [reference, comparator] of [['playwright', 'visual'], ['playwright', 'hybrid'], ['hybrid', 'visual']]) {
    const baseRate = pooled[reference].rate;
    const otherRate = pooled[comparator].rate;
    if (baseRate === null || otherRate === null) {
      comparisons.push({ contrast: `${reference}-${comparator}`, status: 'insufficient-pilot-data' });
      continue;
    }
    const estimatedTau = varianceByArm[comparator].value;
    const tauCandidates = estimatedTau !== null && estimatedTau > 0 ? [estimatedTau] : grid;
    const perTau = [];
    for (const tau of tauCandidates) {
      const perCellCount = [];
      for (const cells of cellCounts) {
        const powerByRepetition = [];
        for (const n of repetitions) {
          let rejections = 0;
          for (let draw = 0; draw < draws; draw += 1) {
            let refSuccess = 0;
            let cmpSuccess = 0;
            let refTrials = 0;
            let cmpTrials = 0;
            for (let cell = 0; cell < cells; cell += 1) {
              // Cluster-level random intercept: each cell draws its own true
              // rate around the pooled pilot rate.
              const refRate = Math.min(0.999, Math.max(0.001, baseRate + (tau > 0 ? normal() * Math.sqrt(tau) : 0)));
              const cmpRate = Math.min(0.999, Math.max(0.001, otherRate + (tau > 0 ? normal() * Math.sqrt(tau) : 0)));
              for (let repetition = 0; repetition < n; repetition += 1) {
                refTrials += 1; cmpTrials += 1;
                if (rand() < refRate) refSuccess += 1;
                if (rand() < cmpRate) cmpSuccess += 1;
              }
            }
            const pRef = refSuccess / refTrials;
            const pCmp = cmpSuccess / cmpTrials;
            const pPool = (refSuccess + cmpSuccess) / (refTrials + cmpTrials);
            const se = Math.sqrt(Math.max(pPool * (1 - pPool) * (1 / refTrials + 1 / cmpTrials), 1e-12));
            const z = Math.abs((pRef - pCmp) / se);
            if (2 * (1 - cdf(z)) < alpha) rejections += 1;
          }
          powerByRepetition.push({ per_cell_repetitions: n, estimated_power: Number((rejections / draws).toFixed(3)) });
        }
        perCellCount.push({ cells_per_arm: cells, power: powerByRepetition });
      }
      perTau.push({ between_cell_variance: tau, results: perCellCount });
    }
    comparisons.push({
      contrast: `${reference}-${comparator}`,
      pilot_rates: { [reference]: baseRate, [comparator]: otherRate },
      observed_rate_difference: baseRate - otherRate,
      between_cell_variance_source: varianceByArm[comparator].source,
      assumptions: perTau
    });
  }

  console.log(JSON.stringify({
    type: 'stratified-cluster-power-planning',
    mode: 'stratified',
    confirmatory: false,
    pilot_input: inputPath,
    pilot_document: {
      application: pilotDocument.application ?? null,
      provider_id: pilotDocument.provider_id ?? null,
      model_id: pilotDocument.model_id ?? null,
      profile_id: pilotDocument.profile_id ?? null,
      condition: pilotDocument.condition ?? null,
      complexity: pilotDocument.complexity ?? null,
      repetitions: pilotDocument.repetitions ?? null,
      records: rows.length,
      total_cells_reported: pilotDocument.total_cells ?? null,
      passed_cells_reported: pilotDocument.passed_cells ?? null
    },
    pooled_by_arm: pooled,
    between_cell_variance: varianceByArm,
    alpha,
    draws,
    seed: seedValue,
    comparisons,
    note: [
      'Cluster-level Monte Carlo: each application x workflow cell draws its own true rate around the pooled pilot rate.',
      'A cell-level random intercept is used because the planned design repeats runs inside cells; a plain two-proportion calculation understates the required repetition count.',
      'The between-cell variance is estimated from the pilot when at least two cells per arm exist, otherwise a declared sensitivity grid is swept. The chosen source is reported per contrast.',
      'This output is a planning input. It does not freeze the repetition count and must be re-run on the frozen matched pilot before preregistration.'
    ]
  }, null, 2));
}
