import { spawn } from 'node:child_process';
import process from 'node:process';

const cwd = process.cwd();
const run = (command, args, env = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', (code) => resolve({ code, stdout, stderr }));
});

const archivePriorFixtureRows = await run('docker', ['exec', 'indico-postgres-1', 'psql', '-U', 'indico', '-d', 'indico', '-c', "UPDATE events.events SET title='PSS Phase2 Event [ARCHIVED]' WHERE title IN ('PSS Phase2 Event', 'PSS Phase2 Event [FAULT]');"]);
if (archivePriorFixtureRows.code !== 0) throw new Error(`fixture isolation failed: ${archivePriorFixtureRows.stderr}`);

const evidence = {
  application: 'indico',
  workflow: 'login-create-event-fault-independent-oracle',
  expected_fault: 'event-title-mismatch',
  trigger_applied: false,
  browser_fault_visible: false,
  independent_oracle_detected_fault: false,
  trigger_removed: false
};

const apply = await run('npm', ['run', 'fault:indico:apply']);
if (apply.code !== 0) throw new Error(`fault apply failed: ${apply.stderr}`);
evidence.trigger_applied = true;
try {
  const browser = await run('npx', ['playwright', 'test', 'tests/traditional/indico-create-event-fault.spec.js', '--project=chromium'], {
    RUN_INDICO_FAULT_WORKFLOW: '1'
  });
  evidence.browser_exit_code = browser.code;
  evidence.browser_fault_visible = browser.code === 0;
  if (browser.code !== 0) {
    throw new Error(`fault browser workflow failed:\n${browser.stdout}\n${browser.stderr}`);
  }

  const oracle = await run('npm', ['run', 'oracle:indico'], { PSS_INDICO_EXPECT_FAULT: '1' });
  evidence.oracle_exit_code = oracle.code;
  evidence.independent_oracle_detected_fault = oracle.code === 0 && /"expected_fault":true/.test(oracle.stdout) && /"passed":true/.test(oracle.stdout);
  evidence.oracle_output = oracle.stdout.trim().split('\n').filter(Boolean).at(-1) ?? null;
} finally {
  const remove = await run('npm', ['run', 'fault:indico:remove']);
  evidence.trigger_removed = remove.code === 0;
  if (remove.code !== 0) throw new Error(`fault remove failed: ${remove.stderr}`);
}

evidence.passed = evidence.trigger_applied && evidence.browser_fault_visible && evidence.independent_oracle_detected_fault && evidence.trigger_removed;
console.log(JSON.stringify(evidence));
if (!evidence.passed) process.exitCode = 1;
