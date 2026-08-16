import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';

const action = process.argv[2];
const codeRoot = resolve(new URL('..', import.meta.url).pathname);
const repositoryRoot = resolve(codeRoot, '..');
const webTestPilotRoot = resolve(process.env.WEBTESTPILOT_ROOT ?? resolve(repositoryRoot, 'third_party/WebTestPilot'));
const applicationDirectory = resolve(webTestPilotRoot, 'webapps/bookstack');
const seedPath = resolve(applicationDirectory, 'seed.sql');
const baseURL = process.env.BOOKSTACK_BASE_URL ?? 'http://127.0.0.1:8081';
const timeoutMs = Number(process.env.SUT_READY_TIMEOUT_MS ?? 180000);
const composeBin = process.env.COMPOSE_BIN ?? 'docker-compose';

function run(command, args, { cwd = applicationDirectory, input, allowFailure = false, quiet = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['pipe', quiet ? 'ignore' : 'inherit', quiet ? 'ignore' : 'inherit'] });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || allowFailure) resolvePromise(code);
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
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2000));
  }
  throw new Error(`BookStack did not become ready within ${timeoutMs} ms: ${lastError}`);
}

async function seedDatabase() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const seed = (await readFile(seedPath, 'utf8')).replaceAll('YYYY-MM-DD', yesterday);
  await run('docker', ['exec', '-i', 'bookstack-db-1', 'mysql', '-u', 'admin', '-padmin', 'bookstack'], { input: seed });
}

async function startOrReset() {
  const startedAt = Date.now();
  await run(composeBin, ['down', '-v', '--remove-orphans'], { allowFailure: true });
  const imageExists = (await run('docker', ['image', 'inspect', 'bookstack-app:latest'], { allowFailure: true, quiet: true })) === 0;
  await run(composeBin, imageExists ? ['up', '-d'] : ['up', '-d', '--build']);
  await waitUntilReady();
  await seedDatabase();
  console.log(JSON.stringify({ status: 'seeded', application: 'bookstack', elapsed_ms: Date.now() - startedAt }));
}

if (!['start', 'reset', 'ready', 'stop', 'status'].includes(action)) {
  console.error('Usage: node scripts/bookstack-lifecycle.mjs <start|reset|ready|stop|status>');
  process.exit(2);
}

if (action === 'start' || action === 'reset') await startOrReset();
if (action === 'ready') await waitUntilReady();
if (action === 'stop') await run(composeBin, ['down', '-v', '--remove-orphans']);
if (action === 'status') await run(composeBin, ['ps']);
