#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('../..', import.meta.url).pathname);
const benchmarkRoot = path.join(repoRoot, 'third_party', 'WebTestPilot', 'benchmark');
const args = process.argv.slice(2);
const outputIndex = args.indexOf('--output');
const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : null;

const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const listFiles = (dir, suffix) => fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((name) => name.endsWith(suffix)).sort()
  : [];
const parseCase = (file) => {
  const text = fs.readFileSync(file, 'utf8');
  return {
    name: text.match(/^name:\s*(.+)$/m)?.[1]?.trim() ?? path.basename(file, '.yaml'),
    setup_function: text.match(/^setup_function:\s*(.+)$/m)?.[1]?.trim() ?? null,
    steps: (text.match(/^[- ]+action:/gm) ?? []).length,
    ground_truth_assertions: (text.match(/ground_truth:/g) ?? []).length,
    sha256: sha256(file)
  };
};

const applications = fs.existsSync(benchmarkRoot)
  ? fs.readdirSync(benchmarkRoot).filter((name) => {
    const candidate = path.join(benchmarkRoot, name);
    return fs.statSync(candidate).isDirectory() && (fs.existsSync(path.join(candidate, 'test_cases')) || fs.existsSync(path.join(candidate, 'bugs')));
  }).sort()
  : [];
const appSummary = applications.map((application) => {
  const casesDir = path.join(benchmarkRoot, application, 'test_cases');
  const bugsDir = path.join(benchmarkRoot, application, 'bugs');
  const cases = listFiles(casesDir, '.yaml').map((name) => parseCase(path.join(casesDir, name)));
  const bugs = listFiles(bugsDir, '.js').map((name) => ({ name: path.basename(name, '.js'), sha256: sha256(path.join(bugsDir, name)) }));
  return { application, case_count: cases.length, bug_count: bugs.length, cases, bugs };
});

const manifestPath = path.join(repoRoot, 'code', 'config', 'replication-subset.v0.1.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const manifestChecks = (manifest.replication_cases ?? []).map((entry) => {
  const localSource = entry.local_source ? path.join(repoRoot, entry.local_source) : null;
  const localBug = entry.local_bug_source ? path.join(repoRoot, entry.local_bug_source) : null;
  return {
    id: entry.id,
    admission_status: entry.admission_status,
    local_source: entry.local_source ?? null,
    local_source_present: Boolean(localSource && fs.existsSync(localSource)),
    local_source_sha256: localSource && fs.existsSync(localSource) ? sha256(localSource) : null,
    local_bug_source: entry.local_bug_source ?? null,
    local_bug_source_present: Boolean(localBug && fs.existsSync(localBug)),
    local_bug_source_sha256: localBug && fs.existsSync(localBug) ? sha256(localBug) : null
  };
});

const result = {
  schema_version: '0.1',
  generated_at: new Date().toISOString(),
  source: 'third_party/WebTestPilot',
  source_license_file: 'third_party/WebTestPilot/LICENSE',
  source_license: fs.existsSync(path.join(repoRoot, 'third_party', 'WebTestPilot', 'LICENSE')) ? fs.readFileSync(path.join(repoRoot, 'third_party', 'WebTestPilot', 'LICENSE'), 'utf8').split(/\r?\n/)[0] : null,
  applications: appSummary,
  manifest_checks: manifestChecks,
  note: 'Inventory and hashes are provenance evidence only. They do not admit cases into confirmatory collection.'
};

if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
}
console.log(JSON.stringify({ status: 'ok', applications: appSummary.length, cases: appSummary.reduce((sum, app) => sum + app.case_count, 0), bugs: appSummary.reduce((sum, app) => sum + app.bug_count, 0), output: outputPath }));
