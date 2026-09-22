import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { sanitizeProviderSummary, sanitizeReplayAction, sanitizeReplayState } from '../../src/replay-artifacts.mjs';

const codeRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

test('provider summaries keep only bounded metadata, never raw content', () => {
  const summary = sanitizeProviderSummary({
    content: 'the model said something long',
    raw: { messages: ['secret prompt'] },
    content_length: 29,
    content_digest: 'a'.repeat(64),
    status: 'ok'
  });
  assert.equal('content' in summary, false);
  assert.equal('raw' in summary, false);
  assert.equal(summary.content_length, 29);
});

test('a typed value is redacted to its length in replay actions', () => {
  const action = sanitizeReplayAction({ type: 'type', text: 'super-secret-password' });
  assert.equal(action.text, undefined);
  assert.equal(action.text_redacted, true);
  assert.equal(action.text_length, 'super-secret-password'.length);
});

test('replay state keeps only whitelisted fields', () => {
  const state = sanitizeReplayState({ milestone: 'search-results', url_path: '/search', authenticated: true, applicationState: 'leak', goldOracle: 'leak' });
  assert.equal(state.milestone, 'search-results');
  assert.equal('applicationState' in state, false);
  assert.equal('goldOracle' in state, false);
});

// Full-line comments are stripped before scanning so a file may document the
// history it fixed without tripping its own regression guard.
function stripComments(source, marker = '#') {
  return source.split(/\r?\n/).filter((line) => !line.trim().startsWith(marker)).join('\n');
}

test('no framework adapter persists a browser profile in a temporary directory', () => {
  // Regression guard: a shared /private/tmp profile leaked cookies across runs
  // and was wiped by OS cleanup, which breaks deterministic reset.
  const guarded = [
    'scripts/framework-browser-use-runner.py',
    'scripts/framework-browser-use-smoke.py',
    'scripts/run-agentlab-bookstack-adapter.py',
    'agentlab_adapter/pss_bookstack.py'
  ];
  for (const relative of guarded) {
    const source = stripComments(fs.readFileSync(path.join(codeRoot, relative), 'utf8'));
    assert.equal(/\/private\/tmp/.test(source), false, `${relative} still references /private/tmp outside a comment`);
    assert.equal(/user_data_dir\s*=\s*["']\//.test(source), false, `${relative} still hardcodes an absolute user_data_dir`);
  }
});

test('no framework adapter hardcodes a machine-specific Chrome path', () => {
  const guarded = [
    'scripts/run-agentlab-bookstack-adapter.py',
    'agentlab_adapter/pss_bookstack.py',
    'scripts/pss_framework_version.py'
  ];
  for (const relative of guarded) {
    const source = stripComments(fs.readFileSync(path.join(codeRoot, relative), 'utf8'));
    // The macOS path may appear only inside the diagnostics-only detector, which
    // never feeds a launch default.
    const assignments = source.match(/executable_path\s*[:=]\s*["']\/Applications/g) ?? [];
    assert.equal(assignments.length, 0, `${relative} hardcodes a Chrome executable path as a default`);
  }
});

test('the python adapters read versions from the installed distribution', () => {
  for (const relative of ['scripts/framework-browser-use-runner.py', 'scripts/framework-browser-use-smoke.py', 'scripts/run-agentlab-bookstack-adapter.py']) {
    const source = fs.readFileSync(path.join(codeRoot, relative), 'utf8');
    assert.match(source, /require_installed\(/, `${relative} does not read its version from the installed distribution`);
  }
});
