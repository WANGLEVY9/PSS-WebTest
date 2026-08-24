import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const errors = [];
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, 'config', name), 'utf8'));
const references = read('benchmark-reference-matrix.v0.1.json');
const metrics = read('metric-dictionary.v0.1.json');
const templates = read('task-template-library.v0.1.json');
const replication = read('replication-subset.v0.1.json');

for (const [name, asset] of [['benchmark references', references], ['metrics', metrics], ['task templates', templates], ['replication subset', replication]]) {
  if (asset.schema_version !== '0.1') errors.push(`${name}: schema_version must be 0.1`);
}
const referenceIds = new Set();
for (const [i, reference] of (references.references ?? []).entries()) {
  if (!reference.id || referenceIds.has(reference.id)) errors.push(`references[${i}]: duplicate/missing id`);
  referenceIds.add(reference.id);
  if (reference.year < 2023) errors.push(`references[${i}]: pre-2023 reference is outside preferred window`);
  if (!reference.paper_url || !reference.repository_url || !reference.pss_role) errors.push(`references[${i}]: paper/repository/role evidence is required`);
  if (!Array.isArray(reference.reusable_design) || !Array.isArray(reference.not_directly_reusable)) errors.push(`references[${i}]: reuse boundary is incomplete`);
}
const metricIds = new Set();
for (const [i, metric] of (metrics.metrics ?? []).entries()) {
  if (!metric.id || metricIds.has(metric.id)) errors.push(`metrics[${i}]: duplicate/missing id`);
  metricIds.add(metric.id);
  for (const field of ['family', 'type', 'definition', 'role', 'censoring']) if (!metric[field]) errors.push(`metrics[${i}].${field} is required`);
}
const templateIds = new Set();
for (const [i, template] of (templates.templates ?? []).entries()) {
  if (!template.id || templateIds.has(template.id)) errors.push(`templates[${i}]: duplicate/missing id`);
  templateIds.add(template.id);
  for (const field of ['family', 'intent_pattern', 'oracle_plan']) if (!template[field]) errors.push(`templates[${i}].${field} is required`);
  if (!Array.isArray(template.benchmark_inspiration) || template.benchmark_inspiration.length === 0) errors.push(`templates[${i}].benchmark_inspiration is required`);
}
if (!metricIds.has('valid_completion') || !metricIds.has('joint_end_to_end_correctness')) errors.push('primary effectiveness metrics are missing');
if (!metricIds.has('repair_success') || !metricIds.has('repetition_stability')) errors.push('maintenance/reliability metrics are missing');

const replicationIds = new Set();
for (const [i, entry] of (replication.replication_cases ?? []).entries()) {
  if (!entry.id || replicationIds.has(entry.id)) errors.push(`replication_cases[${i}]: duplicate/missing id`);
  replicationIds.add(entry.id);
  for (const field of ['source_id', 'source_type', 'task_family', 'source_oracle', 'local_adaptation', 'admission_status']) {
    if (!entry[field]) errors.push(`replication_cases[${i}].${field} is required`);
  }
  if (!Array.isArray(entry.source_urls) || entry.source_urls.length === 0) errors.push(`replication_cases[${i}].source_urls is required`);
  if (!Array.isArray(entry.required_evidence) || entry.required_evidence.length === 0) errors.push(`replication_cases[${i}].required_evidence is required`);
  if (entry.source_type === 'local-third-party-benchmark' && !entry.local_source) errors.push(`replication_cases[${i}].local_source is required for local benchmark assets`);
}
if (!Array.isArray(replication.reuse_policy?.admission_gates) || replication.reuse_policy.admission_gates.length < 5) errors.push('replication reuse policy must define at least five admission gates');

if (errors.length) {
  console.error(`Study asset validation failed (${errors.length} error(s))`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Study asset validation passed: ${referenceIds.size} references, ${metricIds.size} metrics, ${templateIds.size} task blueprints, ${replicationIds.size} replication cases.`);
}
