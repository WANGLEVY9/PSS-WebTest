import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { buildDashboardAnalysis } from '../src/dashboard-analytics.mjs';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const dashboardRoot = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(dashboardRoot, 'public');
const codeRoot = path.resolve(dashboardRoot, '..');
const repositoryRoot = path.resolve(codeRoot, '..');
const artifactsRoot = path.join(repositoryRoot, 'artifacts', 'phase2');
const replayRoot = path.join(artifactsRoot, 'replays');
const matrixPath = path.join(codeRoot, 'config', 'benchmark-matrix.v0.1.json');
const expansionPlanPath = path.join(codeRoot, 'config', 'phase2-large-scale-expansion.v0.1.json');
const dashboardArtifactRoot = path.join(artifactsRoot, 'dashboard');
const dashboardSnapshotPath = path.join(dashboardArtifactRoot, 'overview-latest.json');
const dashboardAnalysisPath = path.join(dashboardArtifactRoot, 'analysis-latest.json');
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

function safeRunId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._-]+$/.test(value) ? value : null;
}

function isLedgerRunRecord(record) {
  return Boolean(record)
    && safeRunId(record.run_id)
    && typeof record.application_id === 'string'
    && typeof record.task_id === 'string'
    && typeof record.condition === 'string'
    && ['visual', 'hybrid', 'playwright'].includes(record.arm)
    && typeof record.status === 'string'
    && Boolean(record.timing)
    && Number.isFinite(record.timing.wall_time_ms)
    && Number.isFinite(record.timing.actions)
    && Number.isFinite(record.timing.retries);
}

function sanitizeAction(action = {}) {
  const type = String(action.type ?? 'unknown');
  const safe = { type };
  if (['click', 'double_click'].includes(type)) {
    if (Number.isFinite(action.x)) safe.x = Math.round(action.x);
    if (Number.isFinite(action.y)) safe.y = Math.round(action.y);
  }
  if (type === 'type') {
    safe.text_redacted = true;
    safe.text_length = typeof action.text === 'string'
      ? action.text.length
      : Number.isInteger(action.text_length) ? action.text_length : null;
  }
  if (type === 'keypress' && typeof action.key === 'string') safe.key = action.key.slice(0, 32);
  if (type === 'wait' && Number.isFinite(action.ms)) safe.ms = Math.round(action.ms);
  if (type === 'scroll' && Number.isFinite(action.delta_y)) safe.delta_y = Math.round(action.delta_y);
  return safe;
}

function sanitizeTrace(trace) {
  if (!Array.isArray(trace)) return [];
  return trace.slice(0, 80).map((entry, index) => ({
    index,
    step: Number.isInteger(entry?.step) ? entry.step : null,
    action: sanitizeAction(entry?.action),
    url: typeof entry?.url === 'string' ? entry.url.slice(0, 500) : null
  }));
}

function sanitizeReplayState(state) {
  if (!state || typeof state !== 'object') return null;
  const safe = {};
  for (const key of ['milestone', 'url_path', 'title_visible', 'title_filled', 'title_length', 'editor_visible', 'editor_focused', 'save_visible', 'save_disabled', 'save_clicked', 'saved_page_visible', 'authenticated', 'request_state']) {
    if (typeof state[key] === 'boolean' || typeof state[key] === 'string' || Number.isInteger(state[key])) safe[key] = typeof state[key] === 'string' ? state[key].slice(0, 120) : state[key];
  }
  return Object.keys(safe).length ? safe : null;
}

function sanitizeProviderEvent(event) {
  if (!event || typeof event !== 'object') return null;
  const safe = {};
  for (const key of ['id', 'provider', 'model', 'finish_reason', 'tool_name', 'error_class']) if (typeof event[key] === 'string') safe[key] = event[key].slice(0, 120);
  for (const key of ['step', 'attempt', 'http_status', 'content_length', 'arguments_length']) if (Number.isInteger(event[key])) safe[key] = event[key];
  for (const key of ['ok', 'has_text_content', 'has_tool_call']) if (typeof event[key] === 'boolean') safe[key] = event[key];
  for (const key of ['content_digest', 'arguments_digest']) if (typeof event[key] === 'string' && /^[a-f0-9]{64}$/i.test(event[key])) safe[key] = event[key];
  if (event.error && typeof event.error === 'object') safe.error = { name: String(event.error.name ?? 'Error').slice(0, 80), message: String(event.error.message ?? '').slice(0, 280) };
  return Object.keys(safe).length ? safe : null;
}

function readReplay(runId) {
  const id = safeRunId(runId);
  if (!id) return null;
  const replay = readJson(path.join(replayRoot, `${id}.json`));
  if (!replay || replay.schema_version !== 'replay-v1' || replay.run_id !== id || !Array.isArray(replay.frames)) return null;
  return replay;
}

function replaySummary(runId) {
  const replay = readReplay(runId);
  return replay ? { available: true, frame_count: replay.frames.length, provider_event_count: Array.isArray(replay.provider_events) ? replay.provider_events.length : 0, schema_version: replay.schema_version } : { available: false, frame_count: 0, provider_event_count: 0, schema_version: null };
}

function compactRecord(record, source, modified) {
  return {
    source,
    modified,
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
    randomization_block: record.randomization_block ?? null,
    reset_digest: record.reset_digest ?? null,
    sut_image_digest: record.sut_image_digest ?? null,
    run_manifest_digest: record.run_manifest_digest ?? null,
    observation_contract: record.provenance?.observation_contract ?? null,
    provider_id: record.provenance?.provider_id ?? null,
    model_id: record.provenance?.model_id ?? null,
    recorded_at_ms: modified,
    replay: replaySummary(record.run_id),
    trajectory: sanitizeTrace(record.trace)
  };
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
        if (!isLedgerRunRecord(record)) continue;
        rows.push(compactRecord(record, file.name, file.modified));
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
  const expansionPlan = readJson(expansionPlanPath);
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
  const analysis = buildDashboardAnalysis({ records, matrix, expansionPlan });
  const payload = {
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
    analysis,
    recent_records: records.slice(0, 40)
  };
  persistDashboardSnapshot(payload);
  return payload;
}

function persistDashboardSnapshot(payload) {
  if (process.env.PSS_DASHBOARD_PERSIST === '0') return;
  try {
    fs.mkdirSync(dashboardArtifactRoot, { recursive: true, mode: 0o700 });
    const temporary = `${dashboardSnapshotPath}.tmp-${process.pid}`;
    fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temporary, dashboardSnapshotPath);
    const analysisTemporary = `${dashboardAnalysisPath}.tmp-${process.pid}`;
    fs.writeFileSync(analysisTemporary, `${JSON.stringify(payload.analysis, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(analysisTemporary, dashboardAnalysisPath);
  } catch (error) {
    console.error(`dashboard snapshot persistence failed: ${error.message}`);
  }
}

function runDetail(runId) {
  const id = safeRunId(runId);
  if (!id) return null;
  const record = recentJsonlRecords().find((item) => item.run_id === id);
  if (!record) return null;
  const replay = readReplay(id);
  const frames = replay?.frames
    .filter((frame) => typeof frame?.filename === 'string' && /^[A-Za-z0-9._-]+\.jpe?g$/i.test(frame.filename))
    .map((frame) => ({
      id: String(frame.id ?? frame.filename),
      phase: String(frame.phase ?? 'frame'),
      step: Number.isInteger(frame.step) ? frame.step : null,
      url: typeof frame.url === 'string' ? frame.url.slice(0, 500) : null,
      action: frame.action ? sanitizeAction(frame.action) : null,
      screenshot_digest: typeof frame.screenshot_digest === 'string' && /^[a-f0-9]{64}$/i.test(frame.screenshot_digest) ? frame.screenshot_digest : null,
      state: sanitizeReplayState(frame.state),
      provider_event_ids: Array.isArray(frame.provider_event_ids) ? frame.provider_event_ids.filter((value) => typeof value === 'string' && /^provider-\d+$/.test(value)).slice(0, 20) : [],
      image_url: `/artifacts/replays/${encodeURIComponent(id)}/${encodeURIComponent(frame.filename)}`
    })) ?? [];
  return {
    record,
    replay: {
      available: Boolean(replay),
      schema_version: replay?.schema_version ?? null,
      outcome: replay?.outcome ?? null,
      frames,
      provider_events: replay?.provider_events?.map(sanitizeProviderEvent).filter(Boolean) ?? [],
      note: replay ? 'Frames are local ignored artifacts; actions redact typed values.' : 'This run has no retained local replay frames. Historical records remain inspectable only at their stored ledger granularity.'
    }
  };
}

function serveReplayFrame(request, response, pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 4 || parts[0] !== 'artifacts' || parts[1] !== 'replays') return json(response, { error: 'not found' }, 404);
  const [, , runId, filename] = parts.map((part) => decodeURIComponent(part));
  const replay = readReplay(runId);
  if (!replay || !/^[A-Za-z0-9._-]+\.jpe?g$/i.test(filename) || !replay.frames.some((frame) => frame.filename === filename)) {
    return json(response, { error: 'not found' }, 404);
  }
  const image = path.resolve(replayRoot, runId, filename);
  const runDirectory = path.resolve(replayRoot, runId);
  if (!image.startsWith(`${runDirectory}${path.sep}`) || !fs.existsSync(image)) return json(response, { error: 'not found' }, 404);
  response.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  fs.createReadStream(image).pipe(response);
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
  const requestUrl = new URL(request.url, `http://${host}`);
  if (requestUrl.pathname === '/api/overview') return json(response, await overview());
  if (requestUrl.pathname === '/api/analysis') return json(response, (await overview()).analysis);
  if (requestUrl.pathname.startsWith('/api/runs/')) {
    const detail = runDetail(decodeURIComponent(requestUrl.pathname.slice('/api/runs/'.length)));
    return detail ? json(response, detail) : json(response, { error: 'run not found' }, 404);
  }
  if (requestUrl.pathname.startsWith('/artifacts/replays/')) return serveReplayFrame(request, response, requestUrl.pathname);
  if (requestUrl.pathname === '/api/events') {
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
