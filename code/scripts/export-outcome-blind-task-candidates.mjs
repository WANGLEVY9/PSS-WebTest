#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const codeRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const snapshotRoot = path.join(codeRoot, 'artifacts', 'benchmark-snapshots');
const manifestPath = path.join(codeRoot, 'config', 'benchmark-artifact-manifest.v1.0.json');
const outputPath = path.join(snapshotRoot, 'outcome-blind-task-candidates-v1.0.json');
const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function candidate({ benchmark_id, source_commit, task_source_id, instruction, sites = [], start_urls = [], require_login = null, difficulty = null, source_file }) {
  return {
    benchmark_id,
    source_commit,
    task_source_id: String(task_source_id),
    instruction_digest: digest(instruction),
    sites: [...new Set(sites.map(String))].sort(),
    start_url_count: start_urls.length,
    require_login,
    difficulty,
    source_file
  };
}

function webarenaCandidates(root, manifestEntry) {
  const sourceFile = path.join(root, 'webarena-verified', 'assets', 'dataset', 'webarena-verified.json');
  return readJson(sourceFile).map((task) => candidate({
    benchmark_id: manifestEntry.id,
    source_commit: manifestEntry.source_commit,
    task_source_id: task.task_id,
    instruction: task.intent,
    sites: task.sites,
    start_urls: task.start_urls,
    source_file: 'webarena-verified/assets/dataset/webarena-verified.json'
  }));
}

function visualWebArenaCandidates(root, manifestEntry) {
  const names = ['test_reddit.raw.json', 'test_classifieds.raw.json', 'test_shopping.raw.json'];
  return names.flatMap((name) => {
    const sourceFile = path.join(root, 'visualwebarena', 'config_files', 'vwa', name);
    return readJson(sourceFile).map((task) => candidate({
      benchmark_id: manifestEntry.id,
      source_commit: manifestEntry.source_commit,
      task_source_id: task.task_id,
      instruction: task.intent,
      sites: task.sites,
      start_urls: task.start_url ? [task.start_url] : [],
      require_login: task.require_login,
      difficulty: {
        reasoning: task.reasoning_difficulty ?? null,
        visual: task.visual_difficulty ?? null,
        overall: task.overall_difficulty ?? null
      },
      source_file: `visualwebarena/config_files/vwa/${name}`
    }));
  });
}

function extractAtaTitle(block) {
  const firstLine = block.split(/\r?\n/, 1)[0] ?? '';
  const withoutMarker = firstLine.replace(/^►,/, '').replace(/,\s*$/, '').trim();
  if (withoutMarker.startsWith('"') && withoutMarker.endsWith('"')) return withoutMarker.slice(1, -1);
  return withoutMarker;
}

function ataCandidates(root, manifestEntry) {
  const names = ['classifieds_failing.csv', 'classifieds_passing.csv', 'onestopshop_failing.csv', 'onestopshop_passing.csv', 'postmill_failing.csv', 'postmill_passing.csv'];
  return names.flatMap((name) => {
    const relativeFile = `ata-zenodo/ISSTA_ARTEFACT/benchmark/${name}`;
    const contents = fs.readFileSync(path.join(root, relativeFile), 'utf8');
    const blocks = contents.split(/(?=^►)/m).filter((block) => /^►/m.test(block));
    const site = name.split('_', 1)[0];
    return blocks.map((block) => {
      const title = extractAtaTitle(block);
      return candidate({
        benchmark_id: manifestEntry.id,
        source_commit: manifestEntry.source_commit,
        task_source_id: title,
        instruction: block,
        sites: [site],
        source_file: relativeFile
      });
    });
  });
}

export function buildOutcomeBlindTaskCandidates({ root = snapshotRoot, manifest = readJson(manifestPath) } = {}) {
  const entries = Object.fromEntries(manifest.mandatory_core.map((entry) => [entry.id, entry]));
  const candidates = [
    ...webarenaCandidates(root, entries['webarena-verified']),
    ...visualWebArenaCandidates(root, entries.visualwebarena),
    ...ataCandidates(root, entries['autonomous-tester-agent-benchmark'])
  ];
  const allowedKeys = new Set(['benchmark_id', 'source_commit', 'task_source_id', 'instruction_digest', 'sites', 'start_url_count', 'require_login', 'difficulty', 'source_file']);
  for (const item of candidates) {
    if (Object.keys(item).some((key) => !allowedKeys.has(key))) throw new Error(`candidate contains a non-outcome-blind field: ${Object.keys(item).find((key) => !allowedKeys.has(key))}`);
    if (!item.task_source_id || !/^[a-f0-9]{64}$/.test(item.instruction_digest)) throw new Error('candidate task identity or instruction digest is invalid');
  }
  return {
    schema_version: '1.0',
    generated_on: new Date().toISOString(),
    status: 'source-inventory-only-screening-pending',
    confirmatory_authorized: false,
    candidate_count: candidates.length,
    candidates,
    limitations: [
      'This inventory contains source task metadata and instruction digests only.',
      'Evaluator configurations, expected values, arm outcomes, and eligibility decisions are intentionally absent.',
      'The candidate count is not an eligible-task denominator until outcome-blind dual screening and adjudication are complete.'
    ]
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const inventory = buildOutcomeBlindTaskCandidates();
  fs.writeFileSync(outputPath, `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(JSON.stringify({ status: inventory.status, output: outputPath, candidate_count: inventory.candidate_count }, null, 2));
}
