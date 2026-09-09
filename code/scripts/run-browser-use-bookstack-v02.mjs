import dotenv from 'dotenv';
import { spawn } from 'node:child_process';
import { appendRunRecord } from '../src/traditional-run-record.mjs';
import { createRunRecord } from '../src/run-records.mjs';
import { loadConfigurationRegistry } from '../src/configuration-registry.mjs';
import { createPhase2Provenance } from '../src/phase2-provenance.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

dotenv.config();
const codeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const python = process.env.PSS_BROWSER_USE_PYTHON || process.env.PSS_BROWSER_USE_BIN;
if (!python) throw new Error('PSS_BROWSER_USE_PYTHON must point to the isolated Browser Use interpreter');
for (const key of ['PSS_CONFIGURATION_ID', 'PSS_RESET_DIGEST', 'PSS_RANDOMIZATION_BLOCK', 'PSS_PROTOCOL_VERSION']) {
  if (!process.env[key]) throw new Error(`${key} is required for a v0.2 Browser Use run`);
}
if (process.env.PSS_CONFIGURATION_ID !== 'hybrid-browser-use-grounded-candidate') throw new Error('Browser Use adapter requires hybrid-browser-use-grounded-candidate');
if (process.env.PSS_BOOKSTACK_TASK_ID && process.env.PSS_BOOKSTACK_TASK_ID !== 'bookstack-open-book') throw new Error('v0.2 Browser Use adapter currently supports bookstack-open-book only');

const runId = process.env.PSS_RUN_ID || `bookstack-browser-use-${Date.now()}`;
const child = spawn(python, ['scripts/framework-browser-use-runner.py'], { cwd: codeRoot, env: { ...process.env, PSS_RUN_ID: runId }, stdio: ['ignore', 'pipe', 'pipe'] });
let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
const exitCode = await new Promise((resolve) => child.on('close', resolve));
const marker = stdout.trim().split('\n').find((line) => line.startsWith('PSS_FRAMEWORK_RESULT:'));
if (!marker) throw new Error(`Browser Use runner returned no redacted result (exit ${exitCode}): ${stderr.slice(-500)}`);
const summary = JSON.parse(marker.slice('PSS_FRAMEWORK_RESULT:'.length));
const registry = loadConfigurationRegistry();
const phase2 = createPhase2Provenance({
  registry,
  configurationId: process.env.PSS_CONFIGURATION_ID,
  runManifestPath: process.env.PSS_RUN_MANIFEST_PATH || path.join(codeRoot, 'config', 'bookstack-navigation-run-manifest.v0.2.json'),
  taskManifestPath: process.env.PSS_TASK_MANIFEST_PATH || path.join(codeRoot, 'manifests', 'task-manifest.v0.1.json'),
  applicationId: 'bookstack',
  resetDigest: process.env.PSS_RESET_DIGEST,
  randomizationBlock: process.env.PSS_RANDOMIZATION_BLOCK,
  environment: { runner: 'browser-use-bookstack-v0.2', base_url: process.env.BOOKSTACK_BASE_URL || 'http://127.0.0.1:8081', framework_version: '0.13.10', use_vision: true, max_steps: Number.parseInt(process.env.CUA_MAX_STEPS || '10', 10) }
});
const runRecord = createRunRecord({
  ...phase2,
  run_id: runId,
  application_id: 'bookstack', application_version: process.env.BOOKSTACK_VERSION || '24.10.1',
  task_id: 'bookstack-open-book', condition: process.env.PSS_PILOT_CONDITION || 'clean-stable', arm: 'hybrid',
  status: summary.status,
  checkpoint_reached: summary.checkpoint_reached === true,
  emitted_verdict: summary.agent_success ? 'clean' : 'not-emitted',
  ground_truth_verdict: 'clean',
  timing: { wall_time_ms: summary.wall_time_ms, actions: summary.actions, retries: summary.retries },
  provenance: { ...phase2.provenance, runner_version: 'browser-use-bookstack-v0.2', observation_contract: 'screenshot-plus-structure' },
  failure_category: summary.failure_category,
  trace: summary.trace
});
appendRunRecord(runRecord, process.env.PSS_RUN_RECORD_OUT);
console.log(JSON.stringify({ framework: 'browser-use', summary, run_record: runRecord, stderr_tail: stderr.slice(-500) }));
if (!runRecord.checkpoint_reached || runRecord.emitted_verdict !== 'clean') process.exitCode = 1;
