import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const codeRoot = resolve(new URL('..', import.meta.url).pathname);
const manifestPath = resolve(codeRoot, 'manifests/task-manifest.v0.1.json');
const errors = [];

function requireValue(value, path) {
  if (value === undefined || value === null || value === '') errors.push(`${path} is required`);
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
requireValue(manifest.manifest_version, 'manifest_version');
requireValue(manifest.study_scope?.reference_cutoff, 'study_scope.reference_cutoff');
if (manifest.study_scope?.reference_cutoff < '2023-01-01') {
  errors.push('study_scope.reference_cutoff must prioritize 2023 or newer work');
}

const applicationIds = new Set();
const taskIds = new Set();
for (const [applicationIndex, application] of (manifest.applications ?? []).entries()) {
  const applicationPath = `applications[${applicationIndex}]`;
  requireValue(application.id, `${applicationPath}.id`);
  requireValue(application.version, `${applicationPath}.version`);
  if (applicationIds.has(application.id)) errors.push(`duplicate application id: ${application.id}`);
  applicationIds.add(application.id);
  if (!['verified', 'needs-review', 'unknown'].includes(application.source?.license_status)) {
    errors.push(`${applicationPath}.source.license_status must be explicit`);
  }
  if (!['unverified', 'smoke-tested', 'admitted'].includes(application.reset?.status)) {
    errors.push(`${applicationPath}.reset.status must be explicit`);
  }
  for (const [taskIndex, task] of (application.tasks ?? []).entries()) {
    const taskPath = `${applicationPath}.tasks[${taskIndex}]`;
    requireValue(task.id, `${taskPath}.id`);
    requireValue(task.intent, `${taskPath}.intent`);
    if (taskIds.has(task.id)) errors.push(`duplicate task id: ${task.id}`);
    taskIds.add(task.id);
    if (!['visual', 'hybrid', 'playwright'].every((arm) => task.arms?.includes(arm))) {
      errors.push(`${taskPath}.arms must include visual, hybrid, and playwright`);
    }
    requireValue(task.oracle?.authority, `${taskPath}.oracle.authority`);
    requireValue(task.oracle?.status, `${taskPath}.oracle.status`);
    requireValue(task.oracle?.assertion, `${taskPath}.oracle.assertion`);
    if (!Array.isArray(task.fault_slots) || task.fault_slots.length === 0) errors.push(`${taskPath}.fault_slots must not be empty`);
    if (!Array.isArray(task.evolution_slots) || task.evolution_slots.length === 0) errors.push(`${taskPath}.evolution_slots must not be empty`);
  }
}

if (errors.length) {
  console.error(`Manifest validation failed (${errors.length} error(s))`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Manifest validation passed: ${manifest.applications.length} applications, ${taskIds.size} tasks, reference cutoff ${manifest.study_scope.reference_cutoff}.`);
}
