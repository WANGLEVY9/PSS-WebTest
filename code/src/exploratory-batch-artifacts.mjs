import fs from 'node:fs';
import path from 'node:path';

export function readBlockPilotSummary({
  artifactRoot,
  runTag,
  requiredArms,
  expectedProvider = null,
  expectedModel = null,
  expectedTaskId = null
}) {
  if (!fs.existsSync(artifactRoot)) return null;
  const candidates = fs.readdirSync(artifactRoot)
    .filter((name) => name.endsWith('-pilot.json') && name.includes(runTag))
    .sort()
    .map((name) => {
      const summaryPath = path.join(artifactRoot, name);
      try { return { summaryPath, summary: JSON.parse(fs.readFileSync(summaryPath, 'utf8')) }; } catch { return null; }
    })
    .filter(Boolean)
    .filter(({ summary }) => (summary.run_tag ?? summary.pilot_run_tag) === runTag)
    .filter(({ summary }) => expectedProvider === null || summary.provider === expectedProvider)
    .filter(({ summary }) => expectedModel === null || summary.model === expectedModel)
    .filter(({ summary }) => expectedTaskId === null || summary.task_id === expectedTaskId);
  if (candidates.length !== 1) return null;
  const { summaryPath, summary } = candidates[0];
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
