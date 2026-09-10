import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const catalog = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config/application-expansion-catalog.v0.1.json'), 'utf8'));
const plan = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config/application-workflow-blueprints.v0.1.json'), 'utf8'));
const errors = [];
const countableIds = new Set((catalog.candidate_applications ?? [])
  .filter((application) => application.status !== 'role-only-not-an-application')
  .map((application) => application.id));
const slotIds = new Set((plan.workflow_slots ?? []).map((slot) => slot.id));

if (plan.schema_version !== '0.1') errors.push('schema_version must be 0.1');
if (plan.status !== 'candidate-workflow-pool-not-admitted') errors.push('workflow blueprint plan must remain candidate-only');
if ((plan.workflow_slots ?? []).length !== 8) errors.push('exactly eight reusable workflow slots are required');
for (const [index, slot] of (plan.workflow_slots ?? []).entries()) {
  if (!slot.id || !slot.complexity || !slot.intent_template || !slot.required_oracle || !slot.fault_axis || !slot.evolution_axis) {
    errors.push(`workflow_slots[${index}] must declare intent, oracle, fault, and evolution axes`);
  }
}
const plannedIds = new Set();
for (const [index, application] of (plan.application_workflow_plan ?? []).entries()) {
  const location = `application_workflow_plan[${index}]`;
  if (!countableIds.has(application.application_id)) errors.push(`${location} references an unknown/non-countable application`);
  if (plannedIds.has(application.application_id)) errors.push(`${location} duplicates an application`);
  plannedIds.add(application.application_id);
  if (application.status !== 'candidate-only') errors.push(`${location}.status must remain candidate-only`);
  if (!Array.isArray(application.workflow_slots) || application.workflow_slots.length !== 8 || new Set(application.workflow_slots).size !== 8) {
    errors.push(`${location}.workflow_slots must contain eight distinct slots`);
  }
  for (const slotId of application.workflow_slots ?? []) if (!slotIds.has(slotId)) errors.push(`${location} references unknown slot ${slotId}`);
}
for (const id of countableIds) if (!plannedIds.has(id)) errors.push(`countable candidate ${id} has no eight-slot workflow plan`);

if (errors.length) {
  console.error(`Application workflow blueprint validation failed (${errors.length} error(s))`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Application workflow blueprint validation passed: ${plannedIds.size} countable applications × ${(plan.workflow_slots ?? []).length} candidate workflow slots; no slots admitted.`);
}
