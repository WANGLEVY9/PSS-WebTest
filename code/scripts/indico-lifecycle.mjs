import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';

const action = process.argv[2];
const codeRoot = resolve(new URL('..', import.meta.url).pathname);
const repositoryRoot = resolve(codeRoot, '..');
const webTestPilotRoot = resolve(process.env.WEBTESTPILOT_ROOT ?? resolve(repositoryRoot, 'third_party/WebTestPilot'));
const applicationDirectory = resolve(webTestPilotRoot, 'webapps/indico');
const seedPath = resolve(applicationDirectory, 'seed.sql');
const overridePath = resolve(codeRoot, 'sut/indico.compose.override.yaml');
// Indico's checked-in BASE_URL is hostname-sensitive; 127.0.0.1 returns a
// canonical-host 404 even when the service is healthy.
const baseURL = process.env.INDICO_BASE_URL ?? 'http://localhost:8080';
const timeoutMs = Number(process.env.SUT_READY_TIMEOUT_MS ?? 600000);
const composeBin = process.env.COMPOSE_BIN ?? 'docker-compose';
const composeFiles = ['-f', 'docker-compose.yaml', '-f', overridePath];

function run(command, args, { input, allowFailure = false, quiet = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: applicationDirectory,
      stdio: ['pipe', quiet ? 'ignore' : 'inherit', quiet ? 'ignore' : 'inherit']
    });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || allowFailure) resolvePromise(code);
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

function capture(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: applicationDirectory,
      stdio: ['ignore', 'pipe', 'inherit']
    });
    let output = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise(output.trim());
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

async function waitUntilReady() {
  const startedAt = Date.now();
  let lastError = 'not attempted';
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(baseURL, { redirect: 'manual' });
      if (response.status >= 200 && response.status < 400) {
        console.log(JSON.stringify({ status: 'ready', url: baseURL, http_status: response.status, elapsed_ms: Date.now() - startedAt }));
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 3000));
  }
  throw new Error(`Indico did not become ready within ${timeoutMs} ms: ${lastError}`);
}

async function seedDatabase() {
  const seed = await readFile(seedPath, 'utf8');
  await run('docker', ['exec', '-i', 'indico-postgres-1', 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'indico', '-d', 'indico'], { input: seed });
  const eventCount = Number(await capture('docker', [
    'exec', 'indico-postgres-1', 'psql', '-U', 'indico', '-d', 'indico',
    '-Atc', 'SELECT count(*) FROM events.events;'
  ]));
  if (eventCount !== 18) throw new Error(`Expected 18 seeded Indico events, found ${eventCount}`);
  console.log(JSON.stringify({ status: 'seed-verified', application: 'indico', event_count: eventCount }));
}

async function startOrReset() {
  const startedAt = Date.now();
  await run(composeBin, [...composeFiles, 'down', '-v', '--remove-orphans'], { allowFailure: true });
  const imageExists = (await run('docker', ['image', 'inspect', 'pss-indico:3.3.6'], { allowFailure: true, quiet: true })) === 0;
  if (!imageExists) await run(composeBin, [...composeFiles, 'build', 'web']);
  await run(composeBin, [...composeFiles, 'up', '-d', '--no-build']);
  await waitUntilReady();
  await seedDatabase();
  console.log(JSON.stringify({ status: 'seeded', application: 'indico', elapsed_ms: Date.now() - startedAt }));
}

if (!['start', 'reset', 'ready', 'stop', 'status'].includes(action)) {
  console.error('Usage: node scripts/indico-lifecycle.mjs <start|reset|ready|stop|status>');
  process.exit(2);
}

if (action === 'start' || action === 'reset') await startOrReset();
if (action === 'ready') await waitUntilReady();
if (action === 'stop') await run(composeBin, [...composeFiles, 'down', '-v', '--remove-orphans']);
if (action === 'status') await run(composeBin, [...composeFiles, 'ps']);
