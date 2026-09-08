import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const dashboardRoot = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(dashboardRoot, 'public');
const codeRoot = path.resolve(dashboardRoot, '..');
const repositoryRoot = path.resolve(codeRoot, '..');
const artifactsRoot = path.join(repositoryRoot, 'artifacts', 'phase2');
const matrixPath = path.join(codeRoot, 'config', 'benchmark-matrix.v0.1.json');
const host = process.env.PSS_DASHBOARD_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.PSS_DASHBOARD_PORT ?? '4173', 10);
const sseClients = new Set();

const SUTS = [
  { id: 'bookstack', name: 'BookStack', url: process.env.BOOKSTACK_BASE_URL ?? 'http://127.0.0.1:8081' },
  { id: 'indico', name: 'Indico', url: process.env.INDICO_BASE_URL ?? 'http://localhost:8080' },
  { id: 'juice-shop', name: 'OWASP Juice Shop', url: process.env.JUICE_SHOP_BASE_URL ?? 'http://127.0.0.1:3000' }
];

function json(response, payload, status = 200) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(`${JSON.stringify(payload)}\n`);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return null; }
}

function recentJsonlRecords() {
  if (!fs.existsSync(artifactsRoot)) return [];
  const files = fs.readdirSync(artifactsRoot)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => ({ name, fullPath: path.join(artifactsRoot, name), modified: fs.statSync(path.join(artifactsRoot, name)).mtimeMs }))
    .sort((a, b) => b.modified - a.modified);
  const rows = [];
  for (const file of files) {
    for (const line of fs.readFileSync(file.fullPath, 'utf8').split(/\r?\n/).filter(Boolean)) {
      try {
        const record = JSON.parse(line);
        rows.push({
          source: file.name,
          modified: file.modified,
          run_id: record.run_id,
          application_id: record.application_id,
          task_id: record.task_id,
          condition: record.condition,
          arm: record.arm,
          status: record.status,
          checkpoint_reached: record.checkpoint_reached === true,
          emitted_verdict: record.emitted_verdict,
          ground_truth_verdict: record.ground_truth_verdict,
          failure_category: record.failure_category ?? null,
          wall_time_ms: record.timing?.wall_time_ms ?? null,
          actions: record.timing?.actions ?? null,
          retries: record.timing?.retries ?? null,
          schema_version: record.schema_version ?? null,
          protocol_version: record.protocol_version ?? null,
          configuration_id: record.configuration_id ?? null,
          observation_contract: record.provenance?.observation_contract ?? null,
          provider_id: record.provenance?.provider_id ?? null,
          model_id: record.provenance?.model_id ?? null,
          recorded_at_ms: file.modified
        });
      } catch {
        // An incomplete final line can exist while a live runner appends; omit
        // it from this refresh rather than presenting corrupt data as evidence.
      }
    }
  }
  return rows.sort((a, b) => b.recorded_at_ms - a.recorded_at_ms);
}

async function checkSut(sut) {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(sut.url, { redirect: 'manual', signal: controller.signal });
    clearTimeout(timer);
    return { ...sut, reachable: response.status >= 200 && response.status < 400, http_status: response.status, latency_ms: Date.now() - started };
  } catch (error) {
    return { ...sut, reachable: false, http_status: null, latency_ms: Date.now() - started, error: error.name === 'AbortError' ? 'timeout' : 'unreachable' };
  }
}

function strictPass(record) {
  return record.status === 'completed' && record.checkpoint_reached && record.emitted_verdict === record.ground_truth_verdict;
}

async function overview() {
  const records = recentJsonlRecords();
  const matrix = readJson(matrixPath) ?? { applications: [] };
  const byTask = new Map();
  for (const record of records) {
    const key = `${record.application_id}/${record.task_id}`;
    const item = byTask.get(key) ?? { n: 0, strict_passes: 0, checkpoint_only: 0, arms: new Set(), failures: {}, latest_ms: 0 };
    item.n += 1;
    item.strict_passes += strictPass(record) ? 1 : 0;
    item.checkpoint_only += record.checkpoint_reached && !strictPass(record) ? 1 : 0;
    item.arms.add(record.arm);
    item.latest_ms = Math.max(item.latest_ms, record.recorded_at_ms);
    if (record.failure_category) item.failures[record.failure_category] = (item.failures[record.failure_category] ?? 0) + 1;
    byTask.set(key, item);
  }
  const tasks = matrix.applications.flatMap((application) => application.workflows.map((workflow) => {
    const evidence = byTask.get(`${application.id}/${workflow.id}`);
    return {
      application_id: application.id,
      application_status: application.status,
      ...workflow,
      evidence: evidence ? {
        ...evidence,
        arms: [...evidence.arms].sort(),
        // Coverage is deliberately weaker than a matched/admitted cell: the
        // dashboard must not infer a shared randomized repetition or any
        // confirmatory status merely because all three arm labels occur.
        all_arms_observed: ['visual', 'hybrid', 'playwright'].every((arm) => evidence.arms.has(arm))
      } : { n: 0, strict_passes: 0, checkpoint_only: 0, arms: [], failures: {}, latest_ms: null, all_arms_observed: false }
    };
  }));
  const suts = await Promise.all(SUTS.map(checkSut));
  const strictPasses = records.filter(strictPass).length;
  const checkpointOnly = records.filter((record) => record.checkpoint_reached && !strictPass(record)).length;
  return {
    generated_at: new Date().toISOString(),
    mode: 'local-read-only-observation',
    refresh_interval_ms: 2500,
    evidence_boundary: 'Pilot and feasibility records are never confirmatory findings. A strict pass requires completed execution, independent checkpoint reach, and a matching emitted/ground-truth verdict.',
    suts,
    tasks,
    ledger: {
      record_count: records.length,
      strict_passes: strictPasses,
      strict_failures: records.length - strictPasses,
      checkpoint_only: checkpointOnly,
      recent_sources: [...new Set(records.slice(0, 12).map((record) => record.source))]
    },
    recent_records: records.slice(0, 40)
  };
}

function serveStatic(request, response) {
  const requested = request.url === '/' ? '/index.html' : new URL(request.url, `http://${host}`).pathname;
  const resolved = path.resolve(publicRoot, `.${requested}`);
  if (!resolved.startsWith(`${publicRoot}${path.sep}`) && resolved !== path.join(publicRoot, 'index.html')) return json(response, { error: 'not found' }, 404);
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return json(response, { error: 'not found' }, 404);
  response.writeHead(200, { 'content-type': types[path.extname(resolved)] ?? 'application/octet-stream', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  fs.createReadStream(resolved).pipe(response);
}

async function publish() {
  if (sseClients.size === 0) return;
  const payload = `event: overview\ndata: ${JSON.stringify(await overview())}\n\n`;
  for (const client of sseClients) client.write(payload);
}

const server = http.createServer(async (request, response) => {
  if (request.url === '/api/overview') return json(response, await overview());
  if (request.url === '/api/events') {
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    sseClients.add(response);
    response.write(`event: overview\ndata: ${JSON.stringify(await overview())}\n\n`);
    request.on('close', () => sseClients.delete(response));
    return;
  }
  return serveStatic(request, response);
});

server.listen(port, host, () => console.log(JSON.stringify({ status: 'ready', url: `http://${host}:${port}`, mode: 'local-read-only-observation' })));
setInterval(() => { publish().catch((error) => console.error(`dashboard refresh failed: ${error.message}`)); }, 2500).unref();
