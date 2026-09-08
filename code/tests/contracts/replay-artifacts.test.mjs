import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeReplayAction } from '../../src/replay-artifacts.mjs';

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
