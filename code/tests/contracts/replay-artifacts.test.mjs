import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createLocalReplayRecorder, sanitizeProviderSummary, sanitizeReplayAction, sanitizeReplayState } from '../../src/replay-artifacts.mjs';

test('replay action preserves interaction evidence while redacting typed values', () => {
  assert.deepEqual(sanitizeReplayAction({ type: 'type', text: 'confidential query' }), {
    type: 'type', text_redacted: true, text_length: 18
  });
  assert.deepEqual(sanitizeReplayAction({ type: 'click', x: 732.6, y: 171.2 }), {
    type: 'click', x: 733, y: 171
  });
});

test('replay action keeps only the declared fields for non-typing actions', () => {
  assert.deepEqual(sanitizeReplayAction({ type: 'keypress', key: 'Enter', text: 'ignored' }), { type: 'keypress', key: 'Enter' });
  assert.deepEqual(sanitizeReplayAction({ type: 'wait', ms: 500, arbitrary: 'ignored' }), { type: 'wait', ms: 500 });
});

test('replay recorder persists screenshot digests, milestone state, and bounded provider summaries', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pss-replay-'));
  const recorder = createLocalReplayRecorder({ runId: 'contract-run', applicationId: 'bookstack', taskId: 'task', arm: 'visual', root });
  const providerId = recorder.recordProviderEvent({
    provider: 'aliyun', model: 'qwen3.7-flash', step: 2, attempt: 0, http_status: 200,
    ok: true, finish_reason: 'tool_calls', has_tool_call: true, content_length: 0,
    arguments_length: 31, arguments_digest: 'a'.repeat(64), prompt: 'must not persist'
  });
  const page = { url: () => 'http://127.0.0.1:8081/books/book', isClosed: () => false };
  const frame = await recorder.capture({ page, buffer: Buffer.from('jpeg-fixture'), phase: 'after-action', step: 2, action: { type: 'click', x: 4, y: 5 }, state: { milestone: 'book-overview', title_filled: false, editor_focused: false, secret: 'ignored' }, providerEventIds: [providerId] });
  const manifest = recorder.finalize({ status: 'completed', checkpointReached: true, emittedVerdict: 'pass', groundTruthVerdict: 'pass', oraclePassed: true });
  assert.match(frame.screenshot_digest, /^[a-f0-9]{64}$/);
  assert.deepEqual(frame.state, { milestone: 'book-overview', title_filled: false, editor_focused: false });
  assert.deepEqual(manifest.provider_events[0], { id: 'provider-000', provider: 'aliyun', model: 'qwen3.7-flash', step: 2, attempt: 0, http_status: 200, ok: true, finish_reason: 'tool_calls', has_tool_call: true, content_length: 0, arguments_length: 31, arguments_digest: 'a'.repeat(64) });
  assert.equal(fs.existsSync(path.join(root, 'contract-run', frame.filename)), true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'contract-run.json'), 'utf8')).frames[0].screenshot_digest, frame.screenshot_digest);
});

test('state and provider sanitizers reject raw values', () => {
  assert.deepEqual(sanitizeReplayState({ milestone: 'new-page-editor', title_length: 4, title: 'secret', authenticated: true }), { milestone: 'new-page-editor', title_length: 4, authenticated: true });
  assert.equal(sanitizeProviderSummary({ content: 'secret prompt', content_digest: 'not-a-digest' }), null);
});
