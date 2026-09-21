#!/usr/bin/env node
import {fileURLToPath} from 'node:url';

/**
 * Sequential T1 condition batch for the two currently runnable local SUTs.
 *
 * This is deliberately a pilot/variance tranche, not confirmatory execution:
 * the explicit PSS_EXECUTE=1 guard is required, each provider/model stays in
 * its own run tag, and a shared SUT is never exercised concurrently.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';

const repetitions = Number.parseInt(process.env.PSS_BATCH_REPETITIONS ?? '2', 10);
if (process.env.PSS_EXECUTE !== '1') throw new Error('refusing to run batch without PSS_EXECUTE=1');
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 3) throw new Error('PSS_BATCH_REPETITIONS must be an integer in [1,3]');

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)), '..');
const codeRoot = path.join(root, 'code');
const artifactRoot = path.join(root, 'artifacts', 'phase2');
const timestamp = process.env.PSS_BATCH_DATE ?? new Date().toISOString().slice(0, 10).replaceAll('-', '');
const blocks = [
  { application: 'juice', npmScript: 'pilot:juice-shop:matched', provider: 'aliyun', model: 'qwen3.7-flash' },
  { application: 'juice', npmScript: 'pilot:juice-shop:matched', provider: 'deepseek', model: 'deepseek-v4-flash-vision-exp' },
  { application: 'indico', npmScript: 'pilot:indico:matched', provider: 'aliyun', model: 'qwen3.7-flash' },
  { application: 'indico', npmScript: 'pilot:indico:matched', provider: 'deepseek', model: 'deepseek-v4-flash-vision-exp' }
].flatMap((block) => ['functional-fault', 'ui-evolution'].map((condition) => ({ ...block, condition })));

fs.mkdirSync(artifactRoot, { recursive: true });
const batchId = `phase2-t1-condition-batch-${timestamp}`;
const manifestPath = path.join(artifactRoot, `${batchId}-manifest.json`);
const logPath = path.join(artifactRoot, `${batchId}.jsonl`);
const results = [];

function runBlock(block) {
  return new Promise((resolve) => {
    const runTag = `${batchId}-${block.application}-${block.provider}-${block.condition}`;
    const env = {
      ...process.env,
      PSS_MATCHED_REPETITIONS: String(repetitions),
      PSS_PILOT_CONDITION: block.condition,
      PSS_PILOT_RUN_TAG: runTag,
      CUA_PROVIDER: block.provider,
      CUA_MODEL: block.model,
      PSS_EXECUTE: undefined
    };
    delete env.PSS_EXECUTE;
    const child = spawn('npm', ['run', block.npmScript], { cwd: codeRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('close', (code, signal) => {
      const jsonLines = stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('{') && line.endsWith('}'));
      const records = jsonLines.flatMap((line) => {
        try { return [JSON.parse(line)]; } catch { return []; }
      }).filter((record) => record.arm && Object.hasOwn(record, 'cell_passed'));
      const entry = {
        batch_id: batchId,
        run_tag: runTag,
        application: block.application,
        provider: block.provider,
        model: block.model,
        condition: block.condition,
        repetitions,
        exit_code: code,
        signal,
        records: records.length,
        strict_passes: records.filter((record) => record.cell_passed === true).length,
        failure_categories: records.reduce((counts, record) => {
          if (record.failure_category) counts[record.failure_category] = (counts[record.failure_category] ?? 0) + 1;
          return counts;
        }, {}),
        stderr_tail: stderr.trim().slice(-1200),
        artifact_hint: path.join(artifactRoot, `${block.application === 'indico' ? 'indico' : 'juice-shop'}-three-arm-${block.provider}-${block.model}-${runTag}-records.jsonl`)
      };
      results.push(entry);
      fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
      resolve(entry);
    });
  });
}

for (const block of blocks) {
  const result = await runBlock(block);
  console.log(JSON.stringify(result));
}

const summary = {
  schema_version: '0.1',
  batch_id: batchId,
  evidence_boundary: 't1-condition-pilot-only',
  confirmatory_authorized: false,
  admission_authorized: false,
  applications: ['indico', 'juice-shop'],
  providers: ['aliyun/qwen3.7-flash', 'deepseek/deepseek-v4-flash-vision-exp'],
  conditions: ['functional-fault', 'ui-evolution'],
  arms: ['visual', 'hybrid', 'playwright'],
  repetitions_per_block: repetitions,
  expected_block_count: blocks.length,
  expected_records: blocks.length * repetitions * 3,
  observed_records: results.reduce((sum, result) => sum + result.records, 0),
  strict_passes: results.reduce((sum, result) => sum + result.strict_passes, 0),
  block_failures: results.filter((result) => result.exit_code !== 0).length,
  blocks: results,
  note: 'Sequential shared-SUT execution; use ledgers and independent oracle outcomes for analysis. This manifest does not authorize repetition freeze or confirmatory collection.'
};
fs.writeFileSync(manifestPath, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ manifest: manifestPath, log: logPath, observed_records: summary.observed_records, expected_records: summary.expected_records, block_failures: summary.block_failures }));
if (summary.observed_records !== summary.expected_records) process.exitCode = 1;
