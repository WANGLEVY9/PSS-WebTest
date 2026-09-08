import fs from 'node:fs';
import path from 'node:path';

export function readBlockPilotSummary({ artifactRoot, runTag, requiredArms }) {
  if (!fs.existsSync(artifactRoot)) return null;
  const candidates = fs.readdirSync(artifactRoot)
    .filter((name) => name.endsWith('-pilot.json') && name.includes(runTag))
    .sort();
  if (candidates.length !== 1) return null;
  const summaryPath = path.join(artifactRoot, candidates[0]);
  let summary;
  try { summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')); } catch { return null; }
  const records = Array.isArray(summary.records) ? summary.records : [];
  const observedArms = [...new Set(records.map((record) => record.arm).filter(Boolean))].sort();
  const fullThreeArmRecord = requiredArms.every((arm) => observedArms.includes(arm)) && observedArms.length === requiredArms.length;
  return {
    summaryPath,
    application: summary.application ?? null,
    taskId: summary.task_id ?? null,
    records,
    observedArms,
    fullThreeArmRecord,
    strictPassedCells: records.filter((record) => record.cell_passed === true).length,
    totalCells: records.length
  };
}
