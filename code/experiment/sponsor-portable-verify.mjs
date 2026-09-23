// Offline verification for the maintained experiment source tree.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const codeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = {python: 'python3'};
for (let i = 2; i < process.argv.length; i++) {
  const flag = process.argv[i];
  if (!['--output', '--python'].includes(flag) || !process.argv[i + 1]) {
    throw Error('Usage: node experiment/sponsor-portable-verify.mjs --output NEW_DIRECTORY [--python PYTHON]');
  }
  options[flag.slice(2)] = process.argv[++i];
}
if (!options.output) throw Error('A new output directory is required');
if (options.python.includes(path.sep)) options.python = path.resolve(options.python);
const output = path.resolve(options.output);
fs.mkdirSync(output, {mode: 0o700});

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const testsIn = dir => fs.readdirSync(path.join(codeRoot, dir))
  .filter(name => name.endsWith('.test.mjs')).sort()
  .map(name => `${dir}/${name}`);
const nativeSuites = new Set([
  'test_runtime_wav_evaluate', 'test_runtime_actor_lifecycle',
  'test_runtime_vwa_evaluate', 'test_runtime_ata_evaluate'
]);
const pythonSuites = fs.readdirSync(path.join(codeRoot, 'experiment'))
  .filter(name => /^test_runtime.*\.py$/.test(name))
  .map(name => name.slice(0, -3))
  .filter(name => !nativeSuites.has(name)).sort();

function sourceInventory() {
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(path.join(codeRoot, dir), {withFileTypes: true})) {
      const relative = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) walk(relative);
      else if (entry.isFile() && /\.(mjs|js|py|json|lock|html|css)$/.test(entry.name)) {
        files.push({file: relative, sha256: sha256(fs.readFileSync(path.join(codeRoot, relative)))});
      }
    }
  }
  for (const dir of ['experiment', 'analysis', 'config', 'console', 'tests', 'tools']) walk(dir);
  for (const name of ['package.json', 'package-lock.json']) {
    files.push({file: name, sha256: sha256(fs.readFileSync(path.join(codeRoot, name)))});
  }
  return files.sort((a, b) => a.file.localeCompare(b.file));
}

// These checks use synthetic fixtures and do not dispatch official tasks.
const steps = [
  {id: 'installed-dependencies', command: 'npm', args: ['ls', '--depth=0']},
  {id: 'current-campaign', command: process.execPath, args: ['experiment/validate-current-campaign.mjs']},
  {id: 'manuscript-design', command: process.execPath, args: ['analysis/validate-active-study.mjs']},
  {id: 'node-runtime-and-browser', tests: true, command: process.execPath,
    args: ['--test', '--test-reporter=tap', ...testsIn('tests/experiment')]},
  {id: 'diagnostic-merge', tests: true, command: process.execPath,
    args: ['--test', '--test-reporter=tap', ...testsIn('tools')]},
  {id: 'python-runtime', tests: true, pythonPath: 'experiment', command: options.python,
    args: ['-m', 'unittest', ...pythonSuites, '-v']},
  {id: 'spend-guard', tests: true, command: options.python,
    args: ['-m', 'unittest', 'discover', '-s', 'experiment', '-p', 'test_spend*.py', '-v']}
];
const sourceBefore = sourceInventory();
const report = {
  kind: 'PSS_OFFLINE_SOURCE_VERIFICATION', started_at: new Date().toISOString(),
  source_files: sourceBefore, source_tree_sha256: sha256(JSON.stringify(sourceBefore)),
  checks: [], model_requests: 0, benchmark_executions: 0, confirmatory_authorized: false,
  native_acceptance: 'not-run',
  scope: 'Source-only engineering checks. Native framework, reset and evaluator acceptance require a separate host profile.'
};
// Do not pass provider credentials into offline tests.
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/^(CUA_|OPENAI_|PSS_|ANTHROPIC_|AZURE_|DEEPSEEK_|DASHSCOPE_|ARK_|GOOGLE_API_KEY|GEMINI_API_KEY)/.test(key)));
environment.PYTHONDONTWRITEBYTECODE = '1';
environment.ANONYMIZED_TELEMETRY = 'false';
environment.BROWSER_USE_VERSION_CHECK = 'false';
for (const step of steps) {
  console.log(`Checking ${step.id} ...`);
  const start = Date.now();
  const run = spawnSync(step.command, step.args, {
    cwd: codeRoot, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024,
    env: {...environment, ...(step.pythonPath ? {PYTHONPATH: path.join(codeRoot, step.pythonPath)} : {})}
  });
  const log = (run.stdout || '') + (run.stderr || '');
  fs.writeFileSync(path.join(output, `${step.id}.log`), log, {mode: 0o600, flag: 'wx'});
  const tap = name => Number(log.match(new RegExp(`^# ${name} (\\d+)$`, 'm'))?.[1] ?? NaN);
  const pythonCount = Number(log.match(/Ran (\d+) tests? in /)?.[1] ?? NaN);
  const testCount = Number.isFinite(tap('tests')) ? tap('tests') : pythonCount;
  const skipped = Number.isFinite(tap('skipped')) ? tap('skipped') :
    Number(log.match(/OK \(skipped=(\d+)\)/)?.[1] ?? 0);
  const passed = Number.isFinite(tap('pass')) ? tap('pass') :
    (run.status === 0 && Number.isFinite(pythonCount) ? pythonCount - skipped : NaN);
  report.checks.push({
    id: step.id, passed: run.status === 0 && (!step.tests ||
      (Number.isFinite(testCount) && testCount > 0 && passed === testCount && skipped === 0)),
    exit_code: run.status, error_code: run.error?.code ?? null,
    tests: Number.isFinite(testCount) ? testCount : null,
    passed_tests: Number.isFinite(passed) ? passed : null,
    skipped_tests: step.tests ? skipped : null,
    elapsed_ms: Date.now() - start, log_sha256: sha256(log)
  });
}
report.finished_at = new Date().toISOString();
report.source_tree_unchanged = JSON.stringify(sourceBefore) === JSON.stringify(sourceInventory());
report.passed = report.source_tree_unchanged && report.checks.every(check => check.passed);
fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n',
  {mode: 0o600, flag: 'wx'});
console.log(JSON.stringify({passed: report.passed, source_tree_unchanged: report.source_tree_unchanged,
  checks: report.checks, model_requests: 0, benchmark_executions: 0,
  confirmatory_authorized: false}, null, 2));
if (!report.passed) process.exitCode = 2;
