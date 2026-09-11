import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const app = process.argv[2];
const action = process.argv[3] ?? 'status';
const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const webappsRoot = path.join(repoRoot, 'third_party', 'WebTestPilot', 'webapps');
const definitions = {
  invoiceninja: {
    port: 8082,
    composeFile: path.join(webappsRoot, 'invoiceninja', 'docker-compose.yaml'),
    envFile: path.join(webappsRoot, 'invoiceninja', '.env'),
    seedFile: path.join(webappsRoot, 'invoiceninja', 'seed.sql'),
    dbContainer: 'invoiceninja-mysql-1',
    appContainer: 'invoiceninja-app-1',
    readyMarkers: ['Invoice Ninja', 'Login'],
    seedCommand: (env) => ['exec', '-i', 'invoiceninja-mysql-1', 'mysql', '-u', env.DB_USERNAME, `-p${env.DB_PASSWORD}`, env.DB_DATABASE],
    snapshotCommand: (env) => ['exec', 'invoiceninja-mysql-1', 'mysql', '-N', '-u', env.DB_USERNAME, `-p${env.DB_PASSWORD}`, env.DB_DATABASE, '-e', 'SELECT COUNT(*) FROM users; SELECT COUNT(*) FROM clients; SELECT COUNT(*) FROM invoices; SELECT COUNT(*) FROM payments; SELECT COUNT(*) FROM products;']
  },
  prestashop: {
    port: 8083,
    composeFile: path.join(webappsRoot, 'prestashop', 'docker-compose.yaml'),
    envFile: path.join(webappsRoot, 'prestashop', '.env'),
    seedFile: path.join(webappsRoot, 'prestashop', 'seed.sql'),
    dbContainer: 'prestashop-db-1',
    appContainer: 'prestashop-app-1',
    readyMarkers: ['PrestaShop', 'Ecommerce'],
    seedCommand: () => ['exec', '-i', 'prestashop-db-1', 'mysql', '-u', 'root', '-proot', 'prestashop'],
    snapshotCommand: () => ['exec', 'prestashop-db-1', 'mysql', '-N', '-u', 'root', '-proot', 'prestashop', '-e', "SELECT COUNT(*) FROM ps_customer; SELECT COUNT(*) FROM ps_product; SELECT COUNT(*) FROM ps_orders; SELECT COUNT(*) FROM ps_cart;"]
  }
};

if (!definitions[app] || !['start', 'reset', 'ready', 'stop', 'status'].includes(action)) {
  console.error('Usage: node scripts/webtestpilot-lifecycle.mjs <invoiceninja|prestashop> <start|reset|ready|stop|status>');
  process.exit(2);
}

const definition = definitions[app];
const appRoot = path.dirname(definition.composeFile);

function parseDotenv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function run(command, args, { cwd = appRoot, input, allowFailure = false, capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: [input === undefined ? 'ignore' : 'pipe', capture ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit'] });
    let stdout = '';
    let stderr = '';
    if (capture) {
      child.stdout.on('data', (chunk) => { stdout += chunk; });
      child.stderr.on('data', (chunk) => { stderr += chunk; });
    }
    if (input !== undefined) child.stdin.end(input);
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0 && !allowFailure) reject(new Error(`${command} ${args.join(' ')} exited with ${code}: ${stderr.trim()}`));
      else resolve({ code, stdout, stderr });
    });
  });
}

async function compose(args, options = {}) {
  return run('docker-compose', ['-f', definition.composeFile, ...args], options);
}

async function waitForReady() {
  const url = `http://127.0.0.1:${definition.port}`;
  const deadline = Date.now() + Number(process.env.SUT_READY_TIMEOUT_MS ?? 240000);
  let last = 'not attempted';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      const text = await response.text();
      const finalUrl = new URL(response.url || url);
      const sameSutHost = ['127.0.0.1', 'localhost'].includes(finalUrl.hostname)
        && (finalUrl.port === String(definition.port) || finalUrl.port === '');
      if (sameSutHost && response.status >= 200 && response.status < 500 && definition.readyMarkers.some((marker) => text.includes(marker))) {
        console.log(JSON.stringify({ application: app, status: 'ready', url, http_status: response.status }));
        return;
      }
      last = `HTTP ${response.status} final_url=${response.url || url}`;
    } catch (error) {
      last = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error(`${app} did not become ready: ${last}`);
}

async function seedAndSnapshot() {
  const env = parseDotenv(await fs.readFile(definition.envFile, 'utf8'));
  let seed = await fs.readFile(definition.seedFile, 'utf8');
  seed = seed.replaceAll('YYYY-MM-DD', new Date(Date.now() - 86400000).toISOString().slice(0, 10));
  await run('docker', definition.seedCommand(env), { input: seed });
  if (app === 'prestashop') {
    await run('docker', ['exec', definition.appContainer, 'php', '/var/www/html/tools/create_user.php']);
    // The fixture helper creates the authenticated customer before a cart is
    // materialized.  Under MySQL strict date validation, that cart can retain
    // a zero date and make the first authenticated request fail with
    // `Property Cart->date_add is not valid`.  Normalize only those generated
    // zero-date rows before admitting the SUT; this does not alter task data.
    await run('docker', [
      'exec', definition.dbContainer, 'mysql', '-u', 'root', '-proot', 'prestashop', '-e',
      "UPDATE ps_cart SET date_add=NOW(), date_upd=NOW() WHERE DATE_FORMAT(date_add,'%Y')='0000' OR DATE_FORMAT(date_upd,'%Y')='0000';"
    ]);
  }
  const snapshot = await run('docker', definition.snapshotCommand(env), { capture: true });
  const counts = snapshot.stdout.trim().split(/\s+/).map(Number);
  if (!counts.length || counts.some((value) => !Number.isInteger(value))) throw new Error(`${app} seed snapshot was not numeric`);
  console.log(JSON.stringify({ application: app, status: 'seed-verified', counts }));
}

if (action === 'status') {
  await compose(['ps'], { allowFailure: true });
} else if (action === 'ready') {
  await waitForReady();
} else if (action === 'stop') {
  await compose(['down', '-v', '--remove-orphans'], { allowFailure: true });
} else if (action === 'start' || action === 'reset') {
  await compose(['down', '-v', '--remove-orphans'], { allowFailure: true });
  await compose(['up', '-d', '--build']);
  await waitForReady();
  await seedAndSnapshot();
  console.log(JSON.stringify({ application: app, status: 'reset-complete', compose_file: path.relative(repoRoot, definition.composeFile) }));
}
