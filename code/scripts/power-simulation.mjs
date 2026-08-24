#!/usr/bin/env node
// Pilot-based planning simulation only. It is not a confirmatory result.
import fs from 'node:fs';
import process from 'node:process';

const inputPath = process.argv[2] ?? '/Users/laurantwang/PSS-WebTest/artifacts/phase2/bookstack-three-arm-pilot.json';
const pilot = fs.existsSync(inputPath) ? JSON.parse(fs.readFileSync(inputPath, 'utf8')) : {
  records: [
    { arm: 'playwright', oracle_passed: true }, { arm: 'playwright', oracle_passed: true }, { arm: 'playwright', oracle_passed: true },
    { arm: 'visual', oracle_passed: false }, { arm: 'hybrid', oracle_passed: false }
  ]
};
const arms = ['playwright', 'visual', 'hybrid'];
const stats = Object.fromEntries(arms.map((arm) => {
  const rows = pilot.records.filter((r) => r.arm === arm && r.reset_ok !== false && r.clean_state_verified !== false);
  // End-to-end success must include agent termination/completion and the
  // independent oracle.  An oracle can pass transiently after a timeout; that
  // is diagnostic evidence, not a successful cell.
  const successes = rows.filter((r) => r.cell_passed ?? (r.agent_completed === true && r.oracle_passed === true)).length;
  // Jeffreys correction avoids treating 0/3 or 3/3 as a certainty.
  return [arm, { n: rows.length, successes, smoothed_rate: (successes + 0.5) / (rows.length + 1) }];
}));
let state = 0x9e3779b9;
const rand = () => ((state = Math.imul(state ^ (state >>> 16), 2246822507) + 3266489909) >>> 0) / 0x100000000;
const normal = () => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-12))) * Math.cos(2 * Math.PI * rand());
const erf = (x) => {
  const sign = x < 0 ? -1 : 1; const ax = Math.abs(x); const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return sign * y;
};
const cdf = (z) => 0.5 * (1 + erf(z / Math.sqrt(2)));
const twoSidedReject = (a, b, n) => {
  const x = Array.from({ length: n }, () => rand() < a ? 1 : 0);
  const y = Array.from({ length: n }, () => rand() < b ? 1 : 0);
  const px = x.reduce((s, v) => s + v, 0) / n; const py = y.reduce((s, v) => s + v, 0) / n;
  const p = (x.reduce((s, v) => s + v, 0) + y.reduce((s, v) => s + v, 0)) / (2 * n);
  const se = Math.sqrt(Math.max(p * (1 - p) * 2 / n, 1e-12));
  return 2 * (1 - cdf(Math.abs((px - py) / se))) < 0.05;
};
const comparisons = [];
for (const arm of ['visual', 'hybrid']) {
  const a = stats.playwright.smoothed_rate; const b = stats[arm].smoothed_rate;
  const power = [];
  for (const n of [6, 12, 24, 48]) {
    let hits = 0; for (let i = 0; i < 2000; i += 1) if (twoSidedReject(a, b, n)) hits += 1;
    power.push({ per_arm_repetitions: n, estimated_power: hits / 2000 });
  }
  comparisons.push({ contrast: `playwright-${arm}`, assumed_rates: { playwright: a, [arm]: b }, power });
}
const output = { type: 'pilot-power-planning', confirmatory: false, pilot_input: inputPath, pilot_stats: stats, comparisons, note: 'Rates are Jeffreys-smoothed pilot planning inputs; freeze only after a valid matched pilot with pre-registered task-condition blocks.' };
console.log(JSON.stringify(output, null, 2));
