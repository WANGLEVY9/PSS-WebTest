import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const repositoryRoot = path.resolve(codeRoot, '..');
const baseURL = process.env.INDICO_BASE_URL ?? 'http://localhost:8080';
const reportPath = path.resolve(process.env.PSS_GATE_RESULT_OUT ?? path.join(repositoryRoot, 'results/phase2/2026-09-13-indico-fault-evolution-gate.md'));

const run = (command, args, env = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, { cwd: codeRoot, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject); child.on('close', (code) => resolve({ code, stdout, stderr }));
});
const lastJson = (stdout) => stdout.trim().split('\n').reverse().map((line) => { try { return JSON.parse(line); } catch { return null; } }).find(Boolean) ?? null;
const reset = async () => {
  const result = await run('node', ['scripts/indico-lifecycle.mjs', 'reset']);
  if (result.code !== 0) throw new Error(`Indico reset failed: ${result.stderr}`);
  return lastJson(result.stdout);
};
const cleanBrowser = async ({ evolution = false } = {}) => run('npx', ['playwright', 'test', 'tests/traditional/indico-create-event.spec.js', '--project=chromium', '--reporter=line'], {
  RUN_INDICO_VERTICAL_SLICE: '1',
  RUN_INDICO_EVOLUTION_WORKFLOW: evolution ? '1' : '0',
  SUT_BASE_URL: baseURL,
  INDICO_BASE_URL: baseURL,
  PSS_INDICO_USERNAME: process.env.PSS_INDICO_USERNAME,
  PSS_INDICO_PASSWORD: process.env.PSS_INDICO_PASSWORD
});
const oracle = async ({ expectFault = false } = {}) => {
  const result = await run('npm', ['run', 'oracle:indico'], { PSS_INDICO_EXPECT_FAULT: expectFault ? '1' : '0' });
  return { exit_code: result.code, output: lastJson(result.stdout) };
};

await reset();
const baselineBrowser = await cleanBrowser();
const baselineOracle = await oracle();

await reset();
const faultRun = await run('npm', ['run', 'pilot:indico:fault']);
const faultEvidence = lastJson(faultRun.stdout) ?? { passed: false, error: faultRun.stderr.slice(-500) };

await reset();
const evolutionBrowser = await cleanBrowser({ evolution: true });
const evolutionOracle = await oracle();

await reset();
const removedBrowser = await cleanBrowser();
const removedOracle = await oracle();

const checks = {
  baseline_browser_and_oracle: baselineBrowser.code === 0 && baselineOracle.output?.passed === true,
  fault_apply_remove_and_independent_oracle: faultEvidence.passed === true,
  evolution_browser_and_oracle: evolutionBrowser.code === 0 && evolutionOracle.output?.passed === true,
  evolution_removed_restores_clean: removedBrowser.code === 0 && removedOracle.output?.passed === true
};
const passed = Object.values(checks).every(Boolean);
const lines = [
  '# Indico fault/evolution apply-remove-isolation gate (2026-09-13)',
  '',
  'Mutation preflight only; no agent arm was run and Indico remains non-admitted.',
  '',
  '| Variant | browser workflow | independent oracle |',
  '|---|---:|---:|',
  `| baseline | ${baselineBrowser.code === 0 ? 'pass' : 'fail'} | ${baselineOracle.output?.passed ? 'pass' : 'fail'} |`,
  `| fault apply/remove | ${faultEvidence.passed ? 'pass' : 'fail'} | ${faultEvidence.independent_oracle_detected_fault ? 'fault detected' : 'fail'} |`,
  `| evolution applied | ${evolutionBrowser.code === 0 ? 'pass' : 'fail'} | ${evolutionOracle.output?.passed ? 'pass' : 'fail'} |`,
  `| evolution removed | ${removedBrowser.code === 0 ? 'pass' : 'fail'} | ${removedOracle.output?.passed ? 'pass' : 'fail'} |`,
  '',
  '## Checks',
  '',
  ...Object.entries(checks).map(([name, value]) => `- ${name}: **${value ? 'pass' : 'fail'}**`),
  '',
  `Gate result: **${passed ? 'PASS' : 'FAIL'}**`,
  '',
  'The evolution mutation is browser-context scoped and presentation-only; the fault workflow uses the independent relational oracle and removes the seeded trigger in a finally path.'
];
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
console.log(JSON.stringify({ application: 'indico', gate: 'fault-evolution-apply-remove-isolation', passed, checks, output: reportPath }, null, 2));
if (!passed) process.exitCode = 1;

