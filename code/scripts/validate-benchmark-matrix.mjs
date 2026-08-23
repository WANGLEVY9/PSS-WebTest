import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const matrixPath = path.resolve(codeRoot, 'config/benchmark-matrix.v0.1.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
const errors = [];
const allowedWorkflowStatus = new Set(['candidate', 'pilot-only', 'admitted-pilot-only']);
const allowedOracleStatus = new Set(['draft', 'independent-verified']);
const requiredArms = new Set(['visual', 'hybrid', 'playwright']);

if (matrix.schema_version !== '0.1') errors.push('schema_version must be 0.1');
if (matrix.reference_cutoff < '2023-01-01') errors.push('reference_cutoff must prioritize 2023 or newer work');
const ids = new Set();
for (const [index, application] of (matrix.applications ?? []).entries()) {
  if (ids.has(application.id)) errors.push(`duplicate application id: ${application.id}`);
  ids.add(application.id);
  const workflowIds = new Set();
  for (const [taskIndex, workflow] of (application.workflows ?? []).entries()) {
    const location = `applications[${index}].workflows[${taskIndex}]`;
    if (workflowIds.has(workflow.id)) errors.push(`duplicate workflow id: ${workflow.id}`);
    workflowIds.add(workflow.id);
    if (!allowedWorkflowStatus.has(workflow.status)) errors.push(`${location}.status is not explicit/admissible`);
    if (!workflow.oracle_authority || !allowedOracleStatus.has(workflow.oracle_status)) errors.push(`${location}.oracle must declare authority and status`);
    if (!Array.isArray(workflow.fault_slots) || workflow.fault_slots.length === 0) errors.push(`${location}.fault_slots must be non-empty`);
    if (!Array.isArray(workflow.evolution_slots) || workflow.evolution_slots.length === 0) errors.push(`${location}.evolution_slots must be non-empty`);
    if (workflow.status === 'candidate' && workflow.oracle_status !== 'draft') errors.push(`${location}: candidate workflow cannot claim verified oracle`);
  }
}
const armIds = new Set((matrix.arms ?? []).map((arm) => arm.id));
for (const arm of requiredArms) if (!armIds.has(arm)) errors.push(`missing required arm: ${arm}`);
if (!Array.isArray(matrix.models) || matrix.models.length < 2) errors.push('at least two model strata must be declared');
if (!Array.isArray(matrix.traditional_baselines) || matrix.traditional_baselines.length < 3) errors.push('traditional baseline matrix is too narrow');

if (errors.length) {
  console.error(`Benchmark matrix validation failed (${errors.length} error(s))`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  const workflowCount = matrix.applications.reduce((total, application) => total + application.workflows.length, 0);
  console.log(`Benchmark matrix validation passed: ${matrix.applications.length} applications, ${workflowCount} workflows, ${matrix.models.length} model strata, ${matrix.traditional_baselines.length} traditional baselines.`);
}
