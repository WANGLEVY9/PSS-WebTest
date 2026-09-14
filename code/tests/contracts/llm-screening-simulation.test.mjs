import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewPrompt, outcomeBlindMaterial, parseReviewOutput } from '../../scripts/simulate-llm-screening-review.mjs';

const candidate = {
  benchmark_id: 'autonomous-tester-agent-benchmark', source_commit: 'commit', task_source_id: 'TC-1-F', instruction_digest: 'a'.repeat(64), sites: ['classifieds'], source_file: 'ata-zenodo/ISSTA_ARTEFACT/benchmark/classifieds_failing.csv', require_login: null, difficulty: null
};

test('LLM review prompt contains rubric and excludes evaluator-bearing material', () => {
  const prompt = buildReviewPrompt({ candidate, material: { instruction: 'Open the homepage and search for motorcycles.', steps: [{ step: 1, action: 'Open homepage', expected_result: 'Homepage is visible' }] }, reviewer: 'qwen-r1' });
  assert.match(prompt, /IC1:/);
  assert.match(prompt, /Use "unclear"/);
  assert.doesNotMatch(prompt, /expected_failure/);
  assert.doesNotMatch(prompt, /"oracle"\s*:/i);
});

test('LLM review output parser requires all seven bounded decisions', () => {
  const criteria = Object.fromEntries(['IC1', 'IC2', 'IC3', 'IC4', 'IC5', 'IC6', 'IC7'].map((code) => [code, { decision: 'unclear', evidence_basis: 'not shown', confidence: 'low' }]));
  const parsed = parseReviewOutput(JSON.stringify({ criteria, overall_note: 'insufficient source proof' }));
  assert.equal(Object.keys(parsed.criteria).length, 7);
  assert.equal(parsed.criteria.IC1.decision, 'unclear');
  assert.throws(() => parseReviewOutput(JSON.stringify({ criteria: { IC1: { decision: 'yes' } } })), /missing a valid IC2/);
});

test('review prompt does not double-prefix VisualWebArena source paths', () => {
  const vwaCandidate = { ...candidate, benchmark_id: 'visualwebarena', task_source_id: '0', source_file: 'visualwebarena/config_files/vwa/test_reddit.raw.json', sites: ['reddit'] };
  const prompt = buildReviewPrompt({ candidate: vwaCandidate, material: outcomeBlindMaterial(vwaCandidate), reviewer: 'deepseek-r1' });
  assert.match(prompt, /__REDDIT__/);
  assert.doesNotMatch(prompt, /visualwebarena\/visualwebarena/);
});

test('source material extraction covers all three benchmark families without expected-failure leakage', async () => {
  const fs = await import('node:fs');
  const sample = JSON.parse(fs.readFileSync(new URL('../../artifacts/benchmark-snapshots/screening-pilot-sample-v1.0.json', import.meta.url), 'utf8'));
  for (const benchmark of ['autonomous-tester-agent-benchmark', 'visualwebarena', 'webarena-verified']) {
    const item = sample.candidates.find((candidate) => candidate.benchmark_id === benchmark);
    const material = outcomeBlindMaterial(item);
    assert.equal(typeof material.instruction, 'string');
    assert.doesNotMatch(JSON.stringify(material), /expected_failure|reference_answer|"eval"/i);
  }
  const quotedAta = sample.candidates.find((candidate) => candidate.task_source_id.startsWith('TC-4-P :: Login, search by keyword'));
  assert.ok(quotedAta);
  assert.match(outcomeBlindMaterial(quotedAta).instruction, /Login/);
});
