import fs from 'node:fs';
import path from 'node:path';

const codeRoot = path.resolve(new URL('..', import.meta.url).pathname);
const catalog = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config/application-expansion-catalog.v0.1.json'), 'utf8'));
const queue = JSON.parse(fs.readFileSync(path.join(codeRoot, 'config/application-triage-queue.v0.1.json'), 'utf8'));
const errors = [];
const countableIds = new Set((catalog.candidate_applications ?? [])
  .filter((application) => application.status !== 'role-only-not-an-application')
  .map((application) => application.id));
const waveIds = new Set();
const queuedIds = new Set();

if (queue.schema_version !== '0.1') errors.push('schema_version must be 0.1');
if (queue.status !== 'triage-only-not-admitted') errors.push('queue must remain triage-only-not-admitted');
for (const [index, wave] of (queue.waves ?? []).entries()) {
  if (!wave.id || !wave.purpose || !Array.isArray(wave.application_ids) || wave.application_ids.length === 0) errors.push(`waves[${index}] must declare id, purpose, and applications`);
  if (waveIds.has(wave.id)) errors.push(`duplicate wave id: ${wave.id}`);
  waveIds.add(wave.id);
  for (const id of wave.application_ids ?? []) {
    if (!countableIds.has(id)) errors.push(`wave ${wave.id} references unknown candidate ${id}`);
    if (queuedIds.has(id)) errors.push(`candidate appears in multiple waves: ${id}`);
    queuedIds.add(id);
  }
}
const statusIds = new Set();
for (const [index, candidate] of (queue.candidate_status ?? []).entries()) {
  if (!countableIds.has(candidate.application_id)) errors.push(`candidate_status[${index}] references unknown candidate ${candidate.application_id}`);
  if (!waveIds.has(candidate.wave)) errors.push(`candidate_status[${index}] references unknown wave ${candidate.wave}`);
  if (!candidate.next_gate || !candidate.risk) errors.push(`candidate_status[${index}] must declare next_gate and risk`);
  if (statusIds.has(candidate.application_id)) errors.push(`duplicate candidate status: ${candidate.application_id}`);
  statusIds.add(candidate.application_id);
}
for (const id of countableIds) {
  if (!queuedIds.has(id)) errors.push(`candidate ${id} is not assigned to a triage wave`);
  if (!statusIds.has(id)) errors.push(`candidate ${id} is missing triage status`);
}
if (errors.length) {
  console.error(`Application triage queue validation failed (${errors.length} error(s))`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Application triage queue validation passed: ${queuedIds.size} candidates across ${(queue.waves ?? []).length} waves; admission remains closed.`);
}
