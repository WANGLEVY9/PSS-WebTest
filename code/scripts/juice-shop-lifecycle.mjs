import { spawn } from 'node:child_process';
import process from 'node:process';

const action = process.argv[2];
const containerName = 'pss-juice-shop';
const image = process.env.JUICE_SHOP_IMAGE ?? 'bkimminich/juice-shop:v20.0.0';
const baseURL = process.env.JUICE_SHOP_BASE_URL ?? 'http://127.0.0.1:3000';
const timeoutMs = Number(process.env.SUT_READY_TIMEOUT_MS ?? 180000);

function run(command, args, { allowFailure = false, quiet = false } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', quiet ? 'ignore' : 'inherit', quiet ? 'ignore' : 'inherit']
    });
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
      const response = await fetch(`${baseURL}/rest/products/search?q=apple`);
      if (response.status === 200) {
        const payload = await response.json();
        if (Array.isArray(payload?.data)) {
          console.log(JSON.stringify({
            status: 'ready',
            application: 'juice-shop',
            url: baseURL,
            http_status: response.status,
            probe_count: payload.data.length,
            elapsed_ms: Date.now() - startedAt
          }));
          return;
        }
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 2000));
  }
  throw new Error(`Juice Shop did not become ready within ${timeoutMs} ms: ${lastError}`);
}

async function stop() {
  await run('docker', ['stop', containerName], { allowFailure: true, quiet: true });
  await run('docker', ['rm', containerName], { allowFailure: true, quiet: true });
}

async function startOrReset() {
  const startedAt = Date.now();
  await stop();
  await run('docker', [
    'run', '--detach', '--rm', '--name', containerName,
    '--publish', '127.0.0.1:3000:3000', image
  ]);
  await waitUntilReady();
  console.log(JSON.stringify({
    status: 'reset-complete',
    application: 'juice-shop',
    image,
    elapsed_ms: Date.now() - startedAt
  }));
}

if (!['start', 'reset', 'ready', 'stop', 'status'].includes(action)) {
  console.error('Usage: node scripts/juice-shop-lifecycle.mjs <start|reset|ready|stop|status>');
  process.exit(2);
}

if (action === 'start' || action === 'reset') await startOrReset();
if (action === 'ready') await waitUntilReady();
if (action === 'stop') await stop();
if (action === 'status') await run('docker', ['ps', '--filter', `name=^/${containerName}$`]);
