#!/usr/bin/env node
/**
 * LLM-assisted, outcome-blind screening simulation.
 *
 * This is diagnostic evidence only. It deliberately uses reviewer ids that
 * cannot be consumed by the human screening store and never writes the
 * canonical screening ledger. Four isolated identities are supported:
 * deepseek-r1, deepseek-r2, qwen-r1, and qwen-r2.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const snapshotRoot = path.join(codeRoot, 'artifacts', 'benchmark-snapshots');
const samplePath = path.join(snapshotRoot, 'screening-pilot-sample-v1.0.json');
const outputRoot = path.join(snapshotRoot, 'llm-screening-simulations');
const criteria = Object.freeze([
  ['IC1', 'Official task in the pinned public release'],
  ['IC2', 'Instruction and evaluator available without semantic edits'],
  ['IC3', 'Executable entirely through the benchmark browser environment'],
  ['IC4', 'Same semantic goal can be attempted by all three paradigms'],
  ['IC5', 'Reproducible reset or benchmark reinitialization'],
  ['IC6', 'Deterministic evaluator or pre-registered tolerance'],
  ['IC7', 'No secret, external, or privileged information required']
]);
const criterionCodes = criteria.map(([code]) => code);
const validDecisions = new Set(['yes', 'no', 'unclear']);
const reviewerSpecs = Object.freeze({
  'deepseek-r1': { reviewer: 'deepseek-r1', provider: 'deepseek', envFile: '.env.deepseek', persona: 'Use a conservative evidence-first review style. Treat absent proof as unclear.' },
  'deepseek-r2': { reviewer: 'deepseek-r2', provider: 'deepseek', envFile: '.env.deepseek', persona: 'Use an independent skeptical review style. Never infer evaluator or reset properties from a task title.' },
  'qwen-r1': { reviewer: 'qwen-r1', provider: 'aliyun', envFile: '.env', persona: 'Use a conservative evidence-first review style. Treat absent proof as unclear.' },
  'qwen-r2': { reviewer: 'qwen-r2', provider: 'aliyun', envFile: '.env', persona: 'Use an independent skeptical review style. Never infer evaluator or reset properties from a task title.' }
});

const sha256 = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
const candidateKey = (candidate) => [candidate.benchmark_id, candidate.source_commit, candidate.task_source_id, candidate.instruction_digest].join('|');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function parseCsvLine(line) {
  const cells = []; let current = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { cells.push(current); current = ''; }
    else current += char;
  }
  cells.push(current);
  return cells;
}

function readAtaBlock(candidate) {
  const source = path.join(snapshotRoot, candidate.source_file);
  const contents = fs.readFileSync(source, 'utf8');
  const blocks = contents.split(/(?=^►)/m).filter((block) => /^►/m.test(block));
  const block = blocks.find((item) => {
    const first = item.split(/\r?\n/, 1)[0] ?? '';
    const title = first.replace(/^►,/, '').replace(/,\s*$/, '').trim();
    return title.startsWith('"') && title.endsWith('"')
      ? title.slice(1, -1).replaceAll('""', '"') === candidate.task_source_id
      : title === candidate.task_source_id;
  });
  if (!block) throw new Error(`ATA source block not found for ${candidate.task_source_id}`);
  const lines = block.split(/\r?\n/).slice(2).filter((line) => line.trim() && !/^,,,$/.test(line));
  const steps = lines.map(parseCsvLine).filter((row) => /^\d+$/.test(row[0] ?? '')).map((row) => ({ step: Number(row[0]), action: row[1] ?? '', expected_result: row[2] ?? '' }));
  return { instruction: steps.map((step) => `${step.step}. ${step.action} — ${step.expected_result}`).join('\n'), steps, sites: candidate.sites };
}

function readJsonTask(file, taskId) {
  const tasks = readJson(file);
  const task = tasks.find((item) => String(item.task_id) === String(taskId));
  if (!task) throw new Error(`task ${taskId} not found in ${path.basename(file)}`);
  return task;
}

export function outcomeBlindMaterial(candidate) {
  if (candidate.benchmark_id === 'webarena-verified') {
    const task = readJsonTask(path.join(snapshotRoot, 'webarena-verified/assets/dataset/webarena-verified.json'), candidate.task_source_id);
    return { instruction: task.intent, sites: task.sites, start_urls: task.start_urls, require_login: null, difficulty: null };
  }
  if (candidate.benchmark_id === 'visualwebarena') {
    const task = readJsonTask(path.join(snapshotRoot, candidate.source_file), candidate.task_source_id);
    return { instruction: task.intent, sites: task.sites, start_urls: task.start_url ? [task.start_url] : [], require_login: task.require_login, difficulty: { reasoning: task.reasoning_difficulty ?? null, visual: task.visual_difficulty ?? null, overall: task.overall_difficulty ?? null } };
  }
  if (candidate.benchmark_id === 'autonomous-tester-agent-benchmark') return readAtaBlock(candidate);
  throw new Error(`unsupported benchmark ${candidate.benchmark_id}`);
}

function assertOutcomeBlindMaterial(material) {
  const forbidden = /(?:^|[_-])(eval|evaluator|oracle|outcome|verdict|expected_failure|reference_answer|gold|agent_run)(?:$|[_-])/i;
  const visit = (value, key = '') => {
    if (forbidden.test(key)) throw new Error(`outcome-bearing field leaked into model material: ${key}`);
    if (Array.isArray(value)) value.forEach((item) => visit(item, key));
    else if (value && typeof value === 'object') Object.entries(value).forEach(([childKey, childValue]) => visit(childValue, childKey));
  };
  visit(material);
  if (typeof material.instruction !== 'string' || material.instruction.length === 0) throw new Error('screening material must contain a non-empty instruction');
}

export function buildReviewPrompt({ candidate, material, reviewer }) {
  assertOutcomeBlindMaterial(material);
  const rubric = criteria.map(([code, label]) => `${code}: ${label}`).join('\n');
  return `You are ${reviewer} in an outcome-blind benchmark eligibility screening simulation. This is not an agent run and you must not infer eligibility from prior model results. You see only the pinned source metadata and the task material below. ${reviewerSpecs[reviewer]?.persona ?? ''}

Return exactly one JSON object with this shape: {"criteria":{"IC1":{"decision":"yes|no|unclear","evidence_basis":"short source-only basis","confidence":"low|medium|high"},...},"overall_note":"short note"}. Include all seven criteria exactly once. Use "unclear" whenever the supplied material does not prove a criterion. Do not use the task title's PASS/FAIL marker as evidence. Do not invent evaluator internals, reset credentials, hidden state, selectors, or agent outcomes.

Rubric:
${rubric}

Candidate metadata (source-only):
${JSON.stringify({ benchmark_id: candidate.benchmark_id, source_commit: candidate.source_commit, task_source_id: candidate.task_source_id, sites: candidate.sites, source_file: candidate.source_file, require_login: candidate.require_login, difficulty: candidate.difficulty }, null, 2)}

Outcome-blind task material:
${JSON.stringify(material, null, 2)}`;
}

function parseJsonContent(content) {
  const text = String(content ?? '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1] ?? text;
  try { return JSON.parse(fenced); } catch { throw new Error('provider did not return parseable JSON'); }
}

export function parseReviewOutput(content) {
  const value = parseJsonContent(content);
  const output = {};
  for (const code of criterionCodes) {
    const entry = value?.criteria?.[code];
    if (!entry || !validDecisions.has(entry.decision)) throw new Error(`provider output is missing a valid ${code} decision`);
    output[code] = { decision: entry.decision, evidence_basis: String(entry.evidence_basis ?? '').slice(0, 800), confidence: ['low', 'medium', 'high'].includes(entry.confidence) ? entry.confidence : 'low' };
  }
  return { criteria: output, overall_note: String(value.overall_note ?? '').slice(0, 1200) };
}

function loadProviderEnv(spec) {
  const envFile = path.join(codeRoot, spec.envFile);
  const values = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile, 'utf8')) : {};
  const env = { ...process.env, ...values };
  if (spec.provider !== env.CUA_PROVIDER) throw new Error(`${spec.reviewer} expected ${spec.provider} but ${env.CUA_PROVIDER ?? '(unset)'} is configured in ${spec.envFile}`);
  for (const key of ['CUA_MODEL', 'CUA_API_KEY']) if (!env[key]?.trim()) throw new Error(`${spec.reviewer} is missing ${key} in ${spec.envFile}`);
  const defaultBase = spec.provider === 'aliyun' ? 'https://dashscope.aliyuncs.com/compatible-mode/v1' : 'https://api.deepseek.com';
  return { provider: spec.provider, model: env.CUA_MODEL.trim(), apiKey: env.CUA_API_KEY.trim(), baseUrl: (env.CUA_BASE_URL?.trim() || defaultBase).replace(/\/$/, '') };
}

async function requestReview({ providerConfig, prompt, timeoutMs = 60000, maxRetries = 3 }) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const body = {
        model: providerConfig.model,
        temperature: 0.2,
        messages: [{ role: 'system', content: 'Return only the requested JSON object. This is an outcome-blind source-screening task.' }, { role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        ...(providerConfig.provider === 'aliyun' ? { max_completion_tokens: 768, enable_thinking: false } : { max_tokens: 768, thinking: { type: 'disabled' } })
      };
      const response = await fetch(`${providerConfig.baseUrl}/chat/completions`, { method: 'POST', headers: { authorization: `Bearer ${providerConfig.apiKey}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${payload?.error?.message ?? 'provider request failed'}`);
      const content = payload?.choices?.[0]?.message?.content;
      return { content, http_status: response.status, finish_reason: payload?.choices?.[0]?.finish_reason ?? null, usage: payload?.usage ?? null, attempt };
    } catch (error) {
      lastError = error;
      const retryable = error?.name === 'AbortError' || /HTTP (429|500|502|503|504)/.test(error?.message ?? '');
      if (!retryable || attempt >= maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, Math.min(8000, 500 * (2 ** attempt))));
    } finally { clearTimeout(timer); }
  }
  throw lastError;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length); let next = 0;
  async function consume() { while (true) { const index = next; next += 1; if (index >= items.length) return; results[index] = await worker(items[index], index); } }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, consume));
  return results;
}

function cohenKappa(first, second) {
  const n = first.length; if (!n) return null;
  const observed = first.filter((value, index) => value === second[index]).length / n;
  const categories = [...validDecisions];
  const expected = categories.reduce((sum, category) => sum + (first.filter((value) => value === category).length / n) * (second.filter((value) => value === category).length / n), 0);
  return expected === 1 ? (observed === 1 ? 1 : 0) : (observed - expected) / (1 - expected);
}

function summarize(records, sampleCount) {
  const byReviewer = {};
  for (const reviewer of Object.keys(reviewerSpecs)) {
    const rows = records.filter((row) => row.reviewer === reviewer && row.status === 'ok');
    const counts = Object.fromEntries(criteria.map(([code]) => [code, Object.fromEntries([...validDecisions].map((decision) => [decision, rows.filter((row) => row.decisions?.[code]?.decision === decision).length]))]));
    byReviewer[reviewer] = { ok: rows.length, failed: records.filter((row) => row.reviewer === reviewer && row.status !== 'ok').length, criteria: counts };
  }
  const pairwise = {};
  const reviewerNames = Object.keys(reviewerSpecs);
  for (let a = 0; a < reviewerNames.length; a += 1) for (let b = a + 1; b < reviewerNames.length; b += 1) {
    const left = reviewerNames[a]; const right = reviewerNames[b]; const leftRows = new Map(records.filter((row) => row.reviewer === left && row.status === 'ok').map((row) => [row.key, row])); const rightRows = new Map(records.filter((row) => row.reviewer === right && row.status === 'ok').map((row) => [row.key, row]));
    const criteriaStats = {};
    for (const code of criterionCodes) { const first = []; const second = []; for (const [key, row] of leftRows) { const other = rightRows.get(key); if (other?.decisions?.[code]?.decision) { first.push(row.decisions[code].decision); second.push(other.decisions[code].decision); } } criteriaStats[code] = { n: first.length, agreement: first.length ? first.filter((value, index) => value === second[index]).length / first.length : null, cohen_kappa: cohenKappa(first, second) }; }
    pairwise[`${left}__${right}`] = criteriaStats;
  }
  return { sample_count: sampleCount, reviewer_count: Object.keys(reviewerSpecs).length, by_reviewer: byReviewer, pairwise };
}

function writeSummaryMarkdown(summary, outputFile) {
  const lines = ['# LLM-assisted screening simulation (diagnostic only)', '', `- Sample tasks: ${summary.sample_count}`, `- Model reviewer identities: ${summary.reviewer_count}`, '- Formal human screening store touched: **no**', '- Confirmatory authorization changed: **no**', '', '## Reviewer completion'];
  for (const [reviewer, data] of Object.entries(summary.by_reviewer)) lines.push(`- ${reviewer}: ${data.ok} successful task reviews; ${data.failed} provider/format failures`);
  lines.push('', '## Interpretation boundary', '', 'These labels are model-generated diagnostic evidence. They do not satisfy the preregistered two-human-reviewer requirement, do not enter the canonical included/excluded denominator, and must not be used to claim screening agreement without human adjudication.', '', '## Pairwise statistics', '');
  for (const [pair, criteriaStats] of Object.entries(summary.pairwise)) { lines.push(`### ${pair}`); for (const [code, stats] of Object.entries(criteriaStats)) lines.push(`- ${code}: n=${stats.n}, agreement=${stats.agreement === null ? 'NA' : stats.agreement.toFixed(3)}, Cohen's kappa=${stats.cohen_kappa === null ? 'NA' : stats.cohen_kappa.toFixed(3)}`); }
  fs.writeFileSync(outputFile, `${lines.join('\n')}\n`);
}

export async function runSimulation({ sample = readJson(samplePath), reviewers = Object.keys(reviewerSpecs), maxTasks = null, concurrency = 3, execute = false, runLabel = new Date().toISOString().slice(0, 10) } = {}) {
  if (!execute) return { status: 'dry-run', sample_count: Math.min(maxTasks ?? sample.candidates.length, sample.candidates.length), reviewers };
  const candidates = (sample.candidates ?? []).slice(0, maxTasks ?? sample.candidates.length);
  const outDir = path.join(outputRoot, runLabel); fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });
  const records = [];
  for (const reviewer of reviewers) {
    if (!reviewerSpecs[reviewer]) throw new Error(`unknown reviewer identity: ${reviewer}`);
    const spec = reviewerSpecs[reviewer]; const providerConfig = loadProviderEnv(spec); const outputFile = path.join(outDir, `${reviewer}.jsonl`); const seen = new Set();
    if (fs.existsSync(outputFile)) {
      const existing = new Map();
      for (const line of fs.readFileSync(outputFile, 'utf8').split(/\r?\n/).filter(Boolean)) {
        try {
          const row = JSON.parse(line);
          if (row.status === 'ok') seen.add(row.key);
          existing.set(row.key, row);
        } catch { /* keep malformed tail recoverable */ }
      }
      records.push(...existing.values());
    }
    const pending = candidates.filter((candidate) => !seen.has(candidateKey(candidate)));
    const results = await mapWithConcurrency(pending, concurrency, async (candidate) => {
      const key = candidateKey(candidate); const started = Date.now();
      try {
        const material = outcomeBlindMaterial(candidate); const prompt = buildReviewPrompt({ candidate, material, reviewer });
        let response; let parsed; let parseError;
        for (let parseAttempt = 0; parseAttempt < 2; parseAttempt += 1) {
          try {
            const retryPrompt = parseAttempt === 0 ? prompt : `${prompt}\nYour previous response was not parseable or omitted a criterion. Return a complete JSON object with all IC1–IC7 keys now; do not add prose or markdown.`;
            response = await requestReview({ providerConfig, prompt: retryPrompt }); parsed = parseReviewOutput(response.content); parseError = null; break;
          } catch (error) { parseError = error; if (parseAttempt === 1) throw error; }
        }
        if (parseError || !response || !parsed) throw parseError ?? new Error('provider review was not completed');
        const row = { schema_version: '1.0', status: 'ok', reviewer, provider: providerConfig.provider, model: providerConfig.model, key, candidate: { benchmark_id: candidate.benchmark_id, source_commit: candidate.source_commit, task_source_id: candidate.task_source_id, instruction_digest: candidate.instruction_digest, source_file: candidate.source_file }, decisions: parsed.criteria, overall_note: parsed.overall_note, provider_meta: { http_status: response.http_status, finish_reason: response.finish_reason, attempt: response.attempt, content_digest: sha256(String(response.content ?? '')), usage: response.usage ?? null }, elapsed_ms: Date.now() - started }; fs.appendFileSync(outputFile, `${JSON.stringify(row)}\n`, { mode: 0o600 }); return row;
      } catch (error) { const row = { schema_version: '1.0', status: 'failed', reviewer, provider: providerConfig.provider, model: providerConfig.model, key, candidate: { benchmark_id: candidate.benchmark_id, source_commit: candidate.source_commit, task_source_id: candidate.task_source_id, instruction_digest: candidate.instruction_digest, source_file: candidate.source_file }, error: { name: error.name, message: error.message }, elapsed_ms: Date.now() - started }; fs.appendFileSync(outputFile, `${JSON.stringify(row)}\n`, { mode: 0o600 }); return row; }
    });
    records.push(...results);
  }
  const latestRecords = new Map(records.map((row) => [`${row.reviewer}::${row.key}`, row]));
  const summary = { schema_version: '1.0', status: 'llm-assisted-screening-diagnostic', generated_on: new Date().toISOString(), confirmatory_authorized: false, human_review_requirement_satisfied: false, source_sample_digest: sha256(JSON.stringify(sample.candidates ?? [])), ...summarize([...latestRecords.values()], candidates.length) };
  fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 }); writeSummaryMarkdown(summary, path.join(outDir, 'SUMMARY.md'));
  return { status: summary.status, output: outDir, summary };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = new Set(process.argv.slice(2)); const valueAfter = (flag, fallback) => { const index = process.argv.indexOf(flag); return index >= 0 ? process.argv[index + 1] ?? fallback : fallback; };
  const reviewers = valueAfter('--reviewers', Object.keys(reviewerSpecs).join(',')).split(',').map((item) => item.trim()).filter(Boolean);
  const maxValue = valueAfter('--max-tasks', ''); const maxTasks = maxValue ? Number.parseInt(maxValue, 10) : null;
  const concurrency = Number.parseInt(valueAfter('--concurrency', '3'), 10);
  const runLabel = valueAfter('--run-label', new Date().toISOString().replace(/[:.]/g, '-'));
  const result = await runSimulation({ reviewers, maxTasks, concurrency, execute: args.has('--execute'), runLabel });
  console.log(JSON.stringify({ status: result.status, output: result.output ?? null, sample_count: result.summary?.sample_count ?? result.sample_count, reviewers: result.reviewers ?? reviewers, confirmatory_authorized: result.summary?.confirmatory_authorized ?? false }, null, 2));
}
