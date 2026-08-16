import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';

const codeRoot = resolve(new URL('..', import.meta.url).pathname);
const repositoryRoot = resolve(codeRoot, '..');
const iterations = Number(process.env.PSS_PILOT_ITERATIONS ?? 10);
const outputPath = resolve(repositoryRoot, 'artifacts/phase2/bookstack-reliability-pilot.json');

function execute(command, args, { env = {}, allowFailure = false } = {}) {
  const startedAt = Date.now();
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: codeRoot,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      const result = { code, elapsed_ms: Date.now() - startedAt, stdout, stderr };
      if (code === 0 || allowFailure) resolvePromise(result);
      else reject(Object.assign(new Error(`${command} exited with ${code}`), { result }));
    });
  });
}

function parseLastJson(stdout) {
  const lines = stdout.trim().split('\n').reverse();
  for (const line of lines) {
    try { return JSON.parse(line); } catch { /* continue */ }
  }
  throw new Error('No JSON result found in command output');
}

const records = [];
for (let iteration = 1; iteration <= iterations; iteration += 1) {
  const reset = await execute('node', ['scripts/bookstack-lifecycle.mjs', 'reset']);
  const negativeOracleCommand = await execute('node', ['scripts/evaluate-bookstack-page.mjs'], { allowFailure: true });
  const negativeOracle = parseLastJson(negativeOracleCommand.stdout);
  const testRun = await execute('npx', ['playwright', 'test', '--project=chromium', '--grep', 'create and persist'], {
    env: {
      SUT_BASE_URL: 'http://127.0.0.1:8081',
      PSS_BROWSER_CHANNEL: 'chrome',
      RUN_BOOKSTACK_VERTICAL_SLICE: '1'
    }
  });
  const positiveOracleCommand = await execute('node', ['scripts/evaluate-bookstack-page.mjs']);
  const positiveOracle = parseLastJson(positiveOracleCommand.stdout);
  const record = {
    iteration,
    reset_ms: reset.elapsed_ms,
    clean_state_verified: negativeOracle.matches === 0 && negativeOracle.passed === false,
    playwright_ms: testRun.elapsed_ms,
    persisted_state_verified: positiveOracle.passed === true && positiveOracle.matches === 1
  };
  records.push(record);
  console.log(JSON.stringify(record));
}

const summary = {
  status: records.every((record) => record.clean_state_verified && record.persisted_state_verified) ? 'passed' : 'failed',
  confirmatory: false,
  application: 'bookstack',
  iterations,
  passed_iterations: records.filter((record) => record.clean_state_verified && record.persisted_state_verified).length,
  browser_channel: 'chrome',
  architecture_note: 'arm64 Colima VM with Rosetta translation for linux/amd64 BookStack image',
  created_at: new Date().toISOString(),
  records
};

await mkdir(resolve(repositoryRoot, 'artifacts/phase2'), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ artifact: outputPath, status: summary.status, passed_iterations: summary.passed_iterations }));
if (summary.status !== 'passed') process.exitCode = 1;
