import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { buildBenchmarkTaskInput } from '../../src/benchmark-task-adapter.mjs';

const instruction = 'Open the site and complete the official task.';
const digest = crypto.createHash('sha256').update(instruction).digest('hex');
const sourceTask = { benchmark_id: 'webarena-verified', source_commit: 'a'.repeat(40), task_source_id: '42', instruction_digest: digest, sites: ['shopping'] };
const screening = { adjudicated_decision: 'yes', task_instruction_digest: digest, screening_manifest_digest: 'b'.repeat(64) };

test('benchmark task adapter requires an eligible outcome-blind screening decision', () => {
  assert.throws(() => buildBenchmarkTaskInput({ sourceTask, instruction, startUrl: 'http://127.0.0.1:7770', screening: { ...screening, adjudicated_decision: null } }), /not adjudicated eligible/);
});

test('benchmark task adapter preserves the instruction and emits only runnable fields', () => {
  const task = buildBenchmarkTaskInput({ sourceTask, instruction, startUrl: 'http://127.0.0.1:7770', screening });
  assert.equal(task.instruction_digest, digest);
  assert.deepEqual(task.start_urls, ['http://127.0.0.1:7770']);
  assert.equal(task.confirmatory_authorized, false);
  assert.equal('evaluator' in task, false);
  assert.equal('expected_answer' in task, false);
});

test('benchmark task adapter rejects digest drift and privileged source fields', () => {
  assert.throws(() => buildBenchmarkTaskInput({ sourceTask: { ...sourceTask, instruction_digest: 'c'.repeat(64) }, instruction, startUrl: 'http://127.0.0.1:7770', screening }), /digest/);
  assert.throws(() => buildBenchmarkTaskInput({ sourceTask: { ...sourceTask, evaluator: { answer: 'x' } }, instruction, startUrl: 'http://127.0.0.1:7770', screening }), /privileged field/);
});
