const ARMS = ['visual', 'hybrid', 'playwright'];

function strictPass(record) {
  return record?.status === 'completed'
    && record?.checkpoint_reached === true
    && record?.emitted_verdict === record?.ground_truth_verdict;
}

function checkpoint(record) {
  return record?.status === 'completed' && record?.checkpoint_reached === true;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values) {
  const usable = values.filter(Number.isFinite);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function summarizeGroup(records) {
  const n = records.length;
  const strictPasses = records.filter(strictPass).length;
  const completed = records.filter(checkpoint).length;
  const failures = {};
  for (const record of records) {
    if (record.failure_category) failures[record.failure_category] = (failures[record.failure_category] ?? 0) + 1;
  }
  return {
    n,
    strict_passes: strictPasses,
    strict_pass_rate: n ? strictPasses / n : null,
    checkpoint_count: completed,
    checkpoint_rate: n ? completed / n : null,
    median_wall_time_ms: median(records.map((record) => record.wall_time_ms)),
    mean_wall_time_ms: mean(records.map((record) => record.wall_time_ms)),
    mean_actions: mean(records.map((record) => record.actions)),
    mean_retries: mean(records.map((record) => record.retries)),
    failure_categories: failures
  };
}

function groupBy(records, keyFn) {
  const groups = new Map();
  for (const record of records) {
    const key = keyFn(record);
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  return groups;
}

function matchedBlockKey(record) {
  const block = record.randomization_block || record.run_id;
  return `${record.application_id ?? 'unknown'}/${record.task_id ?? 'unknown'}/${record.condition ?? 'unknown'}/${block}`;
}

export function buildDashboardAnalysis({ records = [], matrix = { applications: [] }, expansionPlan = null } = {}) {
  const normalized = Array.isArray(records) ? records : [];
  const byArm = groupBy(normalized, (record) => record.arm ?? 'unknown');
  const byConditionArm = groupBy(normalized, (record) => `${record.condition ?? 'unknown'}::${record.arm ?? 'unknown'}`);
  const byApplicationArm = groupBy(normalized, (record) => `${record.application_id ?? 'unknown'}::${record.arm ?? 'unknown'}`);
  // Scripted/deterministic is a valid fallback only for the Playwright arm.
  // Legacy agent pilots may have a model id but no provider_id; keep that
  // stratum explicitly unknown instead of mislabelling it as scripted.
  const byProviderModelArm = groupBy(normalized, (record) => {
    const provider = record.provider_id ?? (record.arm === 'playwright' ? 'scripted' : 'unknown-provider');
    const model = record.model_id ?? (record.arm === 'playwright' ? 'deterministic' : 'unknown-model');
    return `${provider}::${model}::${record.arm ?? 'unknown'}`;
  });
  const byFailure = groupBy(normalized.filter((record) => record.failure_category), (record) => record.failure_category);
  const blocks = groupBy(normalized, matchedBlockKey);
  const completeBlocks = [...blocks.values()].filter((group) => ARMS.every((arm) => group.some((record) => record.arm === arm))).length;
  const strictCompleteBlocks = [...blocks.values()].filter((group) => ARMS.every((arm) => group.some((record) => record.arm === arm && strictPass(record)))).length;
  const observedApplicationIds = new Set(normalized.map((record) => record.application_id).filter(Boolean));
  const observedWorkflowKeys = new Set(normalized.map((record) => `${record.application_id}/${record.task_id}`));
  const target = expansionPlan?.target ?? null;
  const totals = expansionPlan?.derived_totals ?? null;
  const applications = Array.isArray(matrix.applications) ? matrix.applications : [];
  const readyApplicationStatuses = new Set(['admitted', 'frozen']);
  const readyWorkflowStatuses = new Set(['admitted', 'frozen']);
  const applicationRows = applications.map((application) => {
    const workflows = Array.isArray(application.workflows) ? application.workflows : [];
    const readyWorkflows = workflows.filter((workflow) => readyWorkflowStatuses.has(workflow.status));
    return {
      application_id: application.id,
      application_status: application.status,
      declared_workflows: workflows.length,
      ready_workflows: readyWorkflows.length,
      target_workflows: target?.workflows_per_application ?? null,
      workflow_deficit: target ? Math.max(0, target.workflows_per_application - readyWorkflows.length) : null,
      observed_workflows: [...observedWorkflowKeys].filter((key) => key.startsWith(`${application.id}/`)).length,
      arms: ARMS.map((arm) => ({ arm, ...summarizeGroup(byApplicationArm.get(`${application.id}::${arm}`) ?? []) }))
    };
  });
  const admissionBlockers = [];
  if (target && applications.length < target.application_count) admissionBlockers.push(`application registry: ${applications.length}/${target.application_count} declared`);
  const admittedApplications = applications.filter((application) => readyApplicationStatuses.has(application.status));
  if (target && admittedApplications.length < target.application_count) admissionBlockers.push(`application admission: ${admittedApplications.length}/${target.application_count} admitted/frozen`);
  const admittedWorkflowSlots = applicationRows.reduce((sum, row) => sum + row.ready_workflows, 0);
  const targetWorkflowSlots = target ? target.application_count * target.workflows_per_application : null;
  if (target && admittedWorkflowSlots < targetWorkflowSlots) admissionBlockers.push(`workflow admission: ${admittedWorkflowSlots}/${targetWorkflowSlots} admitted/frozen workflow slots`);
  const failureTaxonomy = [...byFailure.entries()]
    .map(([failure_category, group]) => ({
      failure_category,
      count: group.length,
      by_arm: Object.fromEntries(ARMS.map((arm) => [arm, group.filter((record) => record.arm === arm).length]))
    }))
    .sort((a, b) => b.count - a.count || a.failure_category.localeCompare(b.failure_category));
  return {
    schema_version: 'dashboard-analysis-v1',
    evidence_boundary: 'Aggregates are descriptive observability outputs. They do not promote pilot records to confirmatory evidence, and unknown/not-scored truth remains excluded from verdict correctness.',
    summary: {
      observed_runs: normalized.length,
      observed_applications: observedApplicationIds.size,
      observed_workflows: observedWorkflowKeys.size,
      observed_matched_blocks: blocks.size,
      complete_three_arm_blocks: completeBlocks,
      strict_complete_three_arm_blocks: strictCompleteBlocks,
      strict_pass_rate: normalized.length ? normalized.filter(strictPass).length / normalized.length : null,
      declared_applications: applications.length,
      admitted_applications: admittedApplications.length,
      target_applications: target?.application_count ?? null,
      declared_workflow_slots: applicationRows.reduce((sum, row) => sum + row.declared_workflows, 0),
      admitted_workflow_slots: admittedWorkflowSlots,
      target_workflow_slots: targetWorkflowSlots,
      admission_blockers: admissionBlockers
    },
    target: target && totals ? {
      application_count: target.application_count,
      workflows_per_application: target.workflows_per_application,
      condition_count: target.conditions.length,
      strategy_count: target.strategies.length,
      repetitions_per_cell: target.repetitions_per_cell,
      matched_cells: totals.matched_cells,
      execution_units: totals.execution_units,
      observed_execution_units: normalized.length,
      observed_cell_fraction: totals.execution_units ? normalized.length / totals.execution_units : null,
      observed_complete_block_fraction: totals.matched_cells ? completeBlocks / totals.matched_cells : null
    } : null,
    strategy_comparison: ARMS.map((arm) => ({ arm, ...summarizeGroup(byArm.get(arm) ?? []) })),
    condition_comparison: [...(target?.conditions ?? [])].flatMap((condition) => ARMS.map((arm) => ({ condition, arm, ...summarizeGroup(byConditionArm.get(`${condition}::${arm}`) ?? []) }))),
    provider_model_comparison: [...byProviderModelArm.entries()]
      .map(([key, group]) => {
        const [provider_id, model_id, arm] = key.split('::');
        return { provider_id, model_id, arm, ...summarizeGroup(group) };
      })
      .sort((a, b) => `${a.provider_id}/${a.model_id}/${a.arm}`.localeCompare(`${b.provider_id}/${b.model_id}/${b.arm}`)),
    application_comparison: applicationRows,
    failure_taxonomy: failureTaxonomy,
    observed_strata: {
      providers: [...new Set(normalized.map((record) => record.provider_id).filter(Boolean))].sort(),
      models: [...new Set(normalized.map((record) => record.model_id).filter(Boolean))].sort(),
      conditions: [...new Set(normalized.map((record) => record.condition).filter(Boolean))].sort(),
      arms: [...new Set(normalized.map((record) => record.arm).filter(Boolean))].sort()
    }
  };
}

export { strictPass };
