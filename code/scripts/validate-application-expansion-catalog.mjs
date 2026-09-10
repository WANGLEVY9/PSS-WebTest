import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const catalogPath = path.resolve(codeRoot, 'config/application-expansion-catalog.v0.1.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const errors = [];
const applicationIds = new Set();
const candidateIds = new Set();
const validApplicationStatuses = new Set(['candidate-unverified', 'pilot-only', 'admitted-pilot-only', 'admitted-confirmatory']);
const roleOnlyStatuses = new Set(['role-only-not-an-application']);
const requiredTaskFamilies = new Set(['navigation', 'search-navigation', 'multi-step', 'form-persistence', 'cross-page-state', 'authorization', 'runtime']);

function requireField(object, field, location) {
  if (!(field in object) || object[field] === null || object[field] === '') errors.push(`${location}.${field} is required`);
}

if (catalog.schema_version !== '0.1') errors.push('schema_version must be 0.1');
if (catalog.status !== 'candidate-pool-not-admitted') errors.push('catalog must remain fail-closed with status candidate-pool-not-admitted');
if (catalog.current_application_inventory?.admitted_for_confirmatory?.length !== 0) errors.push('no application may be admitted for confirmatory collection in this expansion catalog');

for (const [index, application] of (catalog.candidate_applications ?? []).entries()) {
  const location = `candidate_applications[${index}]`;
  requireField(application, 'id', location);
  requireField(application, 'family', location);
  requireField(application, 'status', location);
  requireField(application, 'official_source', location);
  if (applicationIds.has(application.id)) errors.push(`duplicate application id: ${application.id}`);
  applicationIds.add(application.id);
  if (roleOnlyStatuses.has(application.status)) continue;
  if (!validApplicationStatuses.has(application.status)) errors.push(`${location}.status is not explicit`);
  candidateIds.add(application.id);
  if (!Array.isArray(application.task_families) || application.task_families.length === 0) errors.push(`${location}.task_families must be non-empty`);
  for (const family of application.task_families ?? []) if (!requiredTaskFamilies.has(family)) errors.push(`${location}.task_families contains undeclared family: ${family}`);
  if (!Array.isArray(application.required_gates) || application.required_gates.length < 4) errors.push(`${location}.required_gates must include reset, oracle, licensing, and matched-pilot checks`);
  if (application.status === 'candidate-unverified' && application.version_pin !== null) errors.push(`${location}: unverified candidate cannot claim a version pin`);
}

for (const [index, task] of (catalog.cross_application_task_families ?? []).entries()) {
  const location = `cross_application_task_families[${index}]`;
  requireField(task, 'id', location);
  requireField(task, 'intent', location);
  if (task.status !== 'candidate-unverified') errors.push(`${location}.status must remain candidate-unverified`);
  if (!Array.isArray(task.source_application_types) || task.source_application_types.length === 0) errors.push(`${location}.source_application_types must be non-empty`);
  if (!Array.isArray(task.target_application_types) || task.target_application_types.length === 0) errors.push(`${location}.target_application_types must be non-empty`);
  if (!Array.isArray(task.handoff_contract) || task.handoff_contract.length < 2) errors.push(`${location}.handoff_contract must expose causal handoff fields`);
  if (!Array.isArray(task.oracle_layers) || task.oracle_layers.length < 2) errors.push(`${location}.oracle_layers must include independent source and target checks`);
  if (!Array.isArray(task.admission_requires) || !task.admission_requires.includes('both-applications-admitted')) errors.push(`${location}.admission_requires must require individually admitted applications`);
}

const currentIds = new Set(catalog.current_application_inventory?.pilot_suts ?? []);
for (const id of currentIds) if (candidateIds.has(id)) errors.push(`current pilot SUT must not be duplicated as a candidate: ${id}`);

const target = catalog.expansion_target ?? {};
if (target.target_application_count < 20) errors.push('target_application_count should reserve room for a genuinely broader benchmark');
if (candidateIds.size < 20) errors.push(`candidate pool must expose at least 20 countable applications, got ${candidateIds.size}`);
if (target.authorization !== 'planning-only-until-admission-gates-pass') errors.push('expansion authorization must remain planning-only until gates pass');

if (errors.length) {
  console.error(`Application expansion catalog validation failed (${errors.length} error(s))`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const countableCandidates = [...candidateIds].length;
  console.log(`Application expansion catalog validation passed: ${countableCandidates} countable candidates, ${(catalog.cross_application_task_families ?? []).length} cross-application task families, confirmatory admissions=${catalog.current_application_inventory.admitted_for_confirmatory.length}.`);
}
