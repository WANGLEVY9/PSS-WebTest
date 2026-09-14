import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { validateBenchmarkArtifactManifest } from '../../scripts/validate-benchmark-artifact-manifest.mjs';

const codeRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const manifest = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config', 'benchmark-artifact-manifest.v1.0.json'), 'utf8'));

test('official benchmark sources are pinned without prematurely admitting any benchmark', () => {
  assert.deepEqual(validateBenchmarkArtifactManifest(manifest), []);
  assert.equal(manifest.confirmatory_authorized, false);
  for (const benchmark of manifest.mandatory_core) {
    assert.equal(benchmark.task_artifact.eligible_task_count, null);
    assert.equal(benchmark.environment.three_reset_gate, 'pending');
  }
});

test('ATA source-license and evaluator uncertainty remain visible rather than silently resolved', () => {
  const ata = manifest.mandatory_core.find((item) => item.id === 'autonomous-tester-agent-benchmark');
  assert.equal(ata.license.identifier, 'CC-BY-4.0');
  assert.equal(ata.license.source_repository_license, null);
  assert.equal(ata.evaluator.status, 'requires-independent-semantics-audit');
  assert.match(ata.evaluator.source_audit_finding, /Actor\/Assertor/);
  assert.equal(ata.environment.status, 'not-installed-remote-reset-audited');
  assert.equal(ata.published_artifact.local_checksum, ata.published_artifact.declared_checksum);
  assert.match(ata.published_artifact.local_sha256, /^sha256:[a-f0-9]{64}$/);
});

test('WorkArena++ remains a conditional extension with unstarted access gates', () => {
  assert.equal(manifest.conditional_extension.environment.status, 'not-requested');
  assert.equal(manifest.conditional_extension.environment.three_reset_gate, 'not-started');
  assert.match(manifest.conditional_extension.admission, /^conditional/);
});
