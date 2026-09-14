#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const manifestPath = path.join(codeRoot, 'config', 'benchmark-artifact-manifest.v1.0.json');
const SHA1 = /^[a-f0-9]{40}$/;
const HTTP_URL = /^https:\/\//;

export function validateBenchmarkArtifactManifest(manifest) {
  const errors = [];
  if (manifest?.schema_version !== '1.0') errors.push('schema_version must be 1.0');
  if (manifest?.status !== 'source-pinned-local-reproduction-pending') errors.push('manifest must remain source-pinned and locally pending');
  if (manifest?.confirmatory_authorized !== false) errors.push('artifact manifest cannot authorize confirmatory execution');
  if (!String(manifest?.admission_rule ?? '').includes('necessary but insufficient')) errors.push('manifest must state that source pins are insufficient for admission');

  const core = manifest?.mandatory_core ?? [];
  const expectedCore = ['webarena-verified', 'visualwebarena', 'autonomous-tester-agent-benchmark'];
  if (JSON.stringify(core.map((item) => item.id)) !== JSON.stringify(expectedCore)) errors.push('mandatory core ordering or membership is invalid');
  for (const benchmark of core) {
    if (!SHA1.test(benchmark?.source_commit ?? '')) errors.push(`${benchmark?.id ?? 'unknown'} must have a pinned 40-character source commit`);
    if (!HTTP_URL.test(benchmark?.repository ?? '')) errors.push(`${benchmark?.id ?? 'unknown'} repository URL is invalid`);
    if (!HTTP_URL.test(benchmark?.license?.evidence_url ?? '')) errors.push(`${benchmark?.id ?? 'unknown'} license evidence URL is invalid`);
    if (benchmark?.task_artifact?.status !== 'source-inventoried-eligibility-pending' || benchmark?.task_artifact?.eligible_task_count !== null) errors.push(`${benchmark?.id ?? 'unknown'} may inventory source records but must not claim an eligible population`);
    if (!/^sha256:[a-f0-9]{64}$/.test(benchmark?.task_artifact?.task_manifest_digest ?? '')) errors.push(`${benchmark?.id ?? 'unknown'} requires a source task-manifest digest`);
    if (!Number.isInteger(benchmark?.task_artifact?.source_record_count) || benchmark.task_artifact.source_record_count <= 0) errors.push(`${benchmark?.id ?? 'unknown'} requires a positive source record count`);
    const evaluatorPending = String(benchmark?.evaluator?.status ?? '').includes('pending') || benchmark?.evaluator?.status === 'requires-independent-semantics-audit';
    if (!evaluatorPending) errors.push(`${benchmark?.id ?? 'unknown'} evaluator must remain locally pending or under an independent semantics audit`);
    if (!/^sha256:[a-f0-9]{64}$/.test(benchmark?.evaluator?.evaluator_digest ?? '')) errors.push(`${benchmark?.id ?? 'unknown'} requires a source evaluator fingerprint`);
    if (benchmark?.environment?.three_reset_gate !== 'pending') errors.push(`${benchmark?.id ?? 'unknown'} reset gate must remain pending`);
  }

  const ata = core.find((item) => item.id === 'autonomous-tester-agent-benchmark');
  if (!ata?.published_artifact?.doi || !String(ata?.published_artifact?.declared_checksum ?? '').startsWith('md5:')) errors.push('ATA published artifact DOI and declared checksum are required');
  if (ata?.published_artifact?.local_checksum !== ata?.published_artifact?.declared_checksum) errors.push('ATA local artifact checksum must exactly match the published checksum');
  if (!/^sha256:[a-f0-9]{64}$/.test(ata?.published_artifact?.local_sha256 ?? '')) errors.push('ATA local artifact SHA-256 fingerprint is required');
  if (ata?.evaluator?.status !== 'requires-independent-semantics-audit') errors.push('ATA evaluator semantics audit must remain open');

  const webarena = core.find((item) => item.id === 'webarena-verified');
  if (!/^am1n3e\/webarena-verified-shopping@sha256:[a-f0-9]{64}$/.test(webarena?.environment?.candidate_image?.reference ?? '')) errors.push('WebArena shopping candidate image must be digest-pinned');
  if (webarena?.environment?.candidate_image?.status !== 'digest-pinned-pull-pending') errors.push('WebArena shopping image must remain pull-pending until a local image ID is recorded');

  const extension = manifest?.conditional_extension;
  if (extension?.id !== 'workarena-plus-plus' || !SHA1.test(extension?.source_commit ?? '')) errors.push('conditional WorkArena++ source pin is invalid');
  if (extension?.environment?.status !== 'not-requested' || extension?.environment?.three_reset_gate !== 'not-started') errors.push('WorkArena++ must remain conditional and unstarted');
  if (!String(extension?.admission ?? '').startsWith('conditional')) errors.push('WorkArena++ admission must remain conditional');
  return errors;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const errors = validateBenchmarkArtifactManifest(manifest);
  console.log(JSON.stringify({
    status: errors.length ? 'invalid' : 'source-pins-recorded-local-reproduction-pending',
    manifest: manifestPath,
    mandatory_core: manifest.mandatory_core.map((item) => ({ id: item.id, source_commit: item.source_commit, environment: item.environment.status })),
    conditional_extension: manifest.conditional_extension.id,
    confirmatory_authorized: manifest.confirmatory_authorized,
    errors
  }, null, 2));
  if (errors.length) process.exitCode = 1;
}
