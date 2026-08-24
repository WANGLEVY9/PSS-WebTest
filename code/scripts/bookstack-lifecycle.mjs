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
const baseURL = process.env.BOOKSTACK_BASE_URL ?? `http://127.0.0.1:${process.env.PSS_BOOKSTACK_APP_PORT ?? process.env.APP_PORT ?? '8081'}`;
const appPort = process.env.PSS_BOOKSTACK_APP_PORT ?? process.env.APP_PORT ?? (new URL(baseURL).port || '8081');
const timeoutMs = Number(process.env.SUT_READY_TIMEOUT_MS ?? 180000);
const composeBin = process.env.COMPOSE_BIN ?? 'docker-compose';

function run(command, args, { cwd = applicationDirectory, input, allowFailure = false, quiet = false, env = {} } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: ['pipe', quiet ? 'ignore' : 'inherit', quiet ? 'ignore' : 'inherit'] });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0 || allowFailure) resolvePromise(code);
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code}`));
    });
  });
}

function runCapture(command, args, { cwd = applicationDirectory } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] });
    let stdout = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolvePromise({ code, stdout }));
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

async function waitForDatabase() {
  const startedAt = Date.now();
  let lastError = 'not attempted';
  while (Date.now() - startedAt < timeoutMs) {
    const logs = await runCapture('docker', ['logs', 'bookstack-db-1']);
    const probe = await runCapture('docker', ['exec', 'bookstack-db-1', 'mysql', '-N', '-u', 'admin', '-padmin', '-e', 'SELECT 1;']);
    const initDone = logs.stdout.includes('MySQL init process done. Ready for start up.');
    if (initDone && probe.code === 0 && probe.stdout.trim() === '1') {
      console.log(JSON.stringify({ status: 'database-ready', elapsed_ms: Date.now() - startedAt }));
      return;
    }
    lastError = `mysql initDone=${initDone}, probe exit ${probe.code}, output=${probe.stdout.trim() || 'unknown'}`;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 1000));
  }
  throw new Error(`BookStack database did not become ready within ${timeoutMs} ms: ${lastError}`);
}

async function seedDatabase() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const seed = (await readFile(seedPath, 'utf8')).replaceAll('YYYY-MM-DD', yesterday);
  await run('docker', ['exec', '-i', 'bookstack-db-1', 'mysql', '-u', 'admin', '-padmin', 'bookstack'], { input: seed });
}

async function verifySeed() {
  const probe = await runCapture('docker', [
    'exec', 'bookstack-db-1', 'mysql', '-N', '-u', 'admin', '-padmin', 'bookstack', '-e',
    'SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM books; SELECT COUNT(*) FROM pages;'
  ]);
  if (probe.code !== 0) throw new Error(`BookStack seed verification query exited with ${probe.code}`);
  const [users, books, pages] = probe.stdout.trim().split(/\s+/).map(Number);
  if (![users, books, pages].every(Number.isInteger) || users < 2 || books < 3 || pages < 6) {
    throw new Error(`BookStack seed verification failed: users=${users}, books=${books}, pages=${pages}`);
  }
  console.log(JSON.stringify({ status: 'seed-verified', counts: { users, books, pages } }));
}

async function startOrReset() {
  const startedAt = Date.now();
  const composeEnv = { APP_PORT: String(appPort) };
  await run(composeBin, ['down', '-v', '--remove-orphans'], { allowFailure: true, env: composeEnv });
  // Colima can return from compose down before the DB container releases its
  // volume. Explicitly remove only this SUT's known containers/volumes so a
  // later seed cannot collide with stale primary keys.
  await run('docker', ['rm', '-f', 'bookstack-db-1', 'bookstack-app-1'], { allowFailure: true, quiet: true });
  await run('docker', ['volume', 'rm', '-f', 'bookstack_db', 'bookstack_app_config'], { allowFailure: true, quiet: true });
  const imageExists = (await run('docker', ['image', 'inspect', 'bookstack-app:latest'], { allowFailure: true, quiet: true })) === 0;
  await run(composeBin, imageExists ? ['up', '-d'] : ['up', '-d', '--build'], { env: composeEnv });
  await waitForDatabase();
  await waitUntilReady();
  await seedDatabase();
  await verifySeed();
  console.log(JSON.stringify({ status: 'seeded', application: 'bookstack', elapsed_ms: Date.now() - startedAt }));
}

if (!['start', 'reset', 'ready', 'stop', 'status'].includes(action)) {
  console.error('Usage: node scripts/bookstack-lifecycle.mjs <start|reset|ready|stop|status>');
  process.exit(2);
}

if (action === 'start' || action === 'reset') await startOrReset();
if (action === 'ready') await waitUntilReady();
if (action === 'stop') await run(composeBin, ['down', '-v', '--remove-orphans'], { env: { APP_PORT: String(appPort) } });
if (action === 'status') await run(composeBin, ['ps']);
