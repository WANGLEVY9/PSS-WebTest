import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const planPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(codeRoot, 'config/traditional-500-playwright.v0.1.json');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const errors = [];
if (plan.schema_version !== '0.1') errors.push('schema_version must be 0.1');
if (plan.status !== 'exploratory-preflight-required') errors.push('status must remain exploratory-preflight-required');
if (plan.application !== 'prestashop') errors.push('application must be prestashop');
if (plan.target_executions < 500) errors.push('target_executions must be at least 500');
const counts = plan.complexity_distribution ?? {};
if (['simple', 'medium', 'complex'].some((key) => !Number.isInteger(counts[key]) || counts[key] <= 0)) errors.push('simple, medium, and complex counts must all be positive integers');
if (Object.values(counts).reduce((sum, value) => sum + value, 0) !== plan.target_executions) errors.push('complexity distribution must sum to target_executions');
const ids = new Set();
for (const [index, workflow] of (plan.workflows ?? []).entries()) {
  if (!workflow.id || ids.has(workflow.id)) errors.push(`workflows[${index}].id must be unique`);
  ids.add(workflow.id);
  if (!['simple', 'medium', 'complex'].includes(workflow.complexity)) errors.push(`workflows[${index}].complexity is invalid`);
  if (workflow.mutates_application_state !== false) errors.push(`workflows[${index}] must be read-only for this batch`);
  if (!workflow.oracle) errors.push(`workflows[${index}] must declare an oracle`);
}
if (ids.size !== 3) errors.push('exactly three complexity workflows are required');
if (plan.guardrails?.requires_database_snapshot_before_after !== true) errors.push('database before/after snapshot guard is required');
if (errors.length) {
  console.error(`Traditional 500 plan validation failed (${errors.length} error(s))`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Traditional 500 plan validation passed: ${plan.target_executions} executions (${counts.simple} simple, ${counts.medium} medium, ${counts.complex} complex).`);
}
