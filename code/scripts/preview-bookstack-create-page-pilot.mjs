import 'dotenv/config';
import { createBookStackCreatePagePilotPlan } from '../src/bookstack-create-page-pilot-plan.mjs';

const repetitions = Number.parseInt(process.env.PSS_MATCHED_REPETITIONS ?? '1', 10);
const plan = createBookStackCreatePagePilotPlan({
  condition: process.env.PSS_PILOT_CONDITION ?? 'clean-stable',
  repetitions,
  randomizationSeed: process.env.PSS_RANDOMIZATION_SEED ?? 'bookstack-create-page-phase2-v1',
  runTag: process.env.PSS_PILOT_RUN_TAG ?? null
});

console.log(JSON.stringify({
  preview_only: true,
  task_id: plan.taskId,
  condition: plan.condition,
  expected_verdict: plan.conditionSpec.expectedVerdict,
  fault_applied_per_cell: plan.conditionSpec.applyFault,
  ui_mutation: plan.conditionSpec.uiMutation,
  total_cells: plan.totalCells,
  scripted_cells: plan.scriptedCells,
  external_model_calls: plan.externalModelCalls,
  blocks: plan.blocks,
  cells: plan.cells
}, null, 2));
