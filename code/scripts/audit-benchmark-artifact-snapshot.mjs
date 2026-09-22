#!/usr/bin/env node
import childProcess from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const codeRoot = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const snapshotRoot = path.join(codeRoot, 'artifacts', 'benchmark-snapshots');
const manifestPath = path.join(codeRoot, 'config', 'benchmark-artifact-manifest.v1.0.json');
const outputPath = path.join(snapshotRoot, 'audit-v1.0.json');
const sha256 = (data) => `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
const relative = (value) => path.relative(snapshotRoot, value).split(path.sep).join('/');

function fileDigest(file) {
  return sha256(fs.readFileSync(file));
}

function gitHead(directory) {
  return childProcess.execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
}

function jsonInventory(files) {
  const sourceFiles = files.map((file) => {
    const records = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(records)) throw new Error(`expected JSON array: ${file}`);
    return { file: relative(file), records: records.length, sha256: fileDigest(file) };
  });
  return {
    source_record_count: sourceFiles.reduce((sum, item) => sum + item.records, 0),
    task_manifest_digest: sha256(JSON.stringify(sourceFiles)),
    source_files: sourceFiles
  };
}

function ataInventory(files) {
  const sourceFiles = files.map((file) => {
    const contents = fs.readFileSync(file, 'utf8');
    return {
      file: relative(file),
      records: (contents.match(/^►/gm) ?? []).length,
      nonempty_source_lines: contents.split(/\r?\n/).filter((line) => line.trim()).length,
      sha256: sha256(contents)
    };
  });
  return {
    source_record_count: sourceFiles.reduce((sum, item) => sum + item.records, 0),
    task_manifest_digest: sha256(JSON.stringify(sourceFiles)),
    source_files: sourceFiles
  };
}

function evaluatorFingerprint(files) {
  const sourceFiles = files.map((file) => ({ file: relative(file), sha256: fileDigest(file) }));
  return { evaluator_digest: sha256(JSON.stringify(sourceFiles)), source_files: sourceFiles };
}

function requireEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label} mismatch: expected ${expected}, got ${actual}`);
}

export function buildBenchmarkArtifactSnapshot({ root = snapshotRoot, manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) } = {}) {
  const joined = (...parts) => path.join(root, ...parts);
  const core = Object.fromEntries(manifest.mandatory_core.map((entry) => [entry.id, entry]));
  const webarenaRoot = joined('webarena-verified');
  const visualRoot = joined('visualwebarena');
  const ataRoot = joined('ata-zenodo', 'ISSTA_ARTEFACT');
  const pinataRoot = joined('pinata');
  const zipFile = joined('ISSTA_ARTEFACT.zip');
  const webarenaTasks = jsonInventory([joined('webarena-verified', 'assets', 'dataset', 'webarena-verified.json')]);
  const visualTasks = jsonInventory(['test_reddit.raw.json', 'test_classifieds.raw.json', 'test_shopping.raw.json'].map((name) => joined('visualwebarena', 'config_files', 'vwa', name)));
  const ataTasks = ataInventory(['classifieds_failing.csv', 'classifieds_passing.csv', 'onestopshop_failing.csv', 'onestopshop_passing.csv', 'postmill_failing.csv', 'postmill_passing.csv'].map((name) => joined('ata-zenodo', 'ISSTA_ARTEFACT', 'benchmark', name)));
  const webarenaEvaluator = evaluatorFingerprint(['__init__.py', 'agent_response_evaluator.py', 'base.py', 'network_event_evaluator.py'].map((name) => joined('webarena-verified', 'src', 'webarena_verified', 'core', 'evaluation', 'evaluators', name)));
  const visualEvaluator = evaluatorFingerprint(['__init__.py', 'evaluators.py', 'helper_functions.py', 'image_utils.py'].map((name) => joined('visualwebarena', 'evaluation_harness', name)));
  const ataEvaluator = evaluatorFingerprint([joined('pinata', 'evaluation.py'), joined('pinata', 'src', 'VTAAS', 'workers', 'assertor.py')]);
  const archive = fs.readFileSync(zipFile);
  const archiveMd5 = `md5:${crypto.createHash('md5').update(archive).digest('hex')}`;
  const archiveSha256 = sha256(archive);
  const observations = {
    'webarena-verified': { source_commit: gitHead(webarenaRoot), ...webarenaTasks, ...webarenaEvaluator },
    visualwebarena: { source_commit: gitHead(visualRoot), ...visualTasks, ...visualEvaluator },
    'autonomous-tester-agent-benchmark': { source_commit: gitHead(pinataRoot), archive_md5: archiveMd5, archive_sha256: archiveSha256, ...ataTasks, ...ataEvaluator }
  };
  for (const [id, observation] of Object.entries(observations)) {
    const expected = core[id];
    requireEqual(observation.source_commit, expected.source_commit, `${id} source_commit`);
    requireEqual(observation.task_manifest_digest, expected.task_artifact.task_manifest_digest, `${id} task_manifest_digest`);
    requireEqual(observation.source_record_count, expected.task_artifact.source_record_count, `${id} source_record_count`);
    requireEqual(observation.evaluator_digest, expected.evaluator.evaluator_digest, `${id} evaluator_digest`);
  }
  requireEqual(observations['autonomous-tester-agent-benchmark'].archive_md5, core['autonomous-tester-agent-benchmark'].published_artifact.declared_checksum, 'ATA archive MD5');
  return {
    schema_version: '1.0',
    generated_on: new Date().toISOString(),
    status: 'source-artifacts-verified-admission-pending',
    confirmatory_authorized: false,
    observations,
    limitations: [
      'This snapshot verifies downloaded source artifacts only.',
      'No task screening, benchmark environment, evaluator execution, reset cycle, arm adaptation, or arm outcome is included.',
      'ATA evaluator semantics remain an independent audit gate.'
    ]
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const audit = buildBenchmarkArtifactSnapshot();
  fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
  console.log(JSON.stringify({ status: audit.status, output: outputPath, core: Object.fromEntries(Object.entries(audit.observations).map(([id, value]) => [id, { source_record_count: value.source_record_count, task_manifest_digest: value.task_manifest_digest }])) }, null, 2));
}
