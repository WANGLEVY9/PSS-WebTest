const READY_APPLICATION_STATUSES = new Set(['admitted', 'frozen']);
const READY_WORKFLOW_STATUSES = new Set(['admitted', 'frozen']);

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

export function validateLargeScaleExpansionPlan(plan) {
  const errors = [];
  if (plan?.schema_version !== '0.1') errors.push('schema_version must be 0.1');
  if (plan?.id !== 'phase2-30-app-8-workflow-conditional-expansion-v1') errors.push('id must identify the 30-app expansion plan');
  if (!['planning-not-authorized', 'ready-for-confirmatory'].includes(plan?.status)) {
    errors.push('status must be planning-not-authorized or ready-for-confirmatory');
  }
  const target = plan?.target;
  if (!target || !isPositiveInteger(target.application_count)) errors.push('target.application_count must be positive');
  if (!target || !isPositiveInteger(target.workflows_per_application)) errors.push('target.workflows_per_application must be positive');
  if (!target || !isPositiveInteger(target.repetitions_per_cell)) errors.push('target.repetitions_per_cell must be positive');
  if (!Array.isArray(target?.conditions) || target.conditions.length !== 3 || !target.conditions.includes('clean-stable') || !target.conditions.includes('functional-fault') || !target.conditions.includes('ui-evolved')) {
    errors.push('target.conditions must contain clean-stable, functional-fault, and ui-evolved');
  }
  if (!Array.isArray(target?.strategies) || target.strategies.length !== 3 || new Set(target.strategies).size !== 3 || !['visual', 'hybrid', 'playwright'].every((id) => target.strategies.includes(id))) {
    errors.push('target.strategies must contain visual, hybrid, and playwright exactly once');
  }
  const derived = plan?.derived_totals;
  const expectedCells = target && isPositiveInteger(target.application_count) && isPositiveInteger(target.workflows_per_application) && Array.isArray(target.conditions) && Array.isArray(target.strategies)
    ? target.application_count * target.workflows_per_application * target.conditions.length * target.strategies.length
    : null;
  const expectedExecutions = expectedCells !== null && isPositiveInteger(target.repetitions_per_cell) ? expectedCells * target.repetitions_per_cell : null;
  if (!derived || derived.matched_cells !== expectedCells) errors.push(`derived_totals.matched_cells must equal ${expectedCells ?? 'the target product'}`);
  if (!derived || derived.execution_units !== expectedExecutions) errors.push(`derived_totals.execution_units must equal ${expectedExecutions ?? 'matched_cells × repetitions_per_cell'}`);
  if (!derived || derived.per_strategy_execution_units !== (expectedExecutions === null || !Array.isArray(target?.strategies) ? null : target.application_count * target.workflows_per_application * target.conditions.length * target.repetitions_per_cell)) errors.push('derived_totals.per_strategy_execution_units is inconsistent');
  if (!Array.isArray(plan?.workflow_blueprints) || plan.workflow_blueprints.length !== target?.workflows_per_application || new Set(plan.workflow_blueprints).size !== plan.workflow_blueprints.length) errors.push('workflow_blueprints must provide one distinct blueprint per target workflow slot');
  if (!Array.isArray(plan?.admission_rule) || plan.admission_rule.length < 5) errors.push('admission_rule must preserve the full admission gate');
  if (!Array.isArray(plan?.non_substitution_rules) || plan.non_substitution_rules.length < 3) errors.push('non_substitution_rules must remain explicit');
  return errors;
}

export function deriveLargeScaleInventory({ plan, benchmarkMatrix, taskManifest = null }) {
  const applications = Array.isArray(benchmarkMatrix?.applications) ? benchmarkMatrix.applications : [];
  const target = plan.target;
  const readyApplications = applications.filter((application) => READY_APPLICATION_STATUSES.has(application.status));
  const applicationRows = applications.map((application) => {
    const workflows = Array.isArray(application.workflows) ? application.workflows : [];
    const readyWorkflows = workflows.filter((workflow) => READY_WORKFLOW_STATUSES.has(workflow.status));
    return {
      id: application.id,
      status: application.status,
      declared_workflows: workflows.length,
      ready_workflows: readyWorkflows.length,
      target_workflow_deficit: Math.max(0, target.workflows_per_application - readyWorkflows.length),
      ready_for_target: READY_APPLICATION_STATUSES.has(application.status) && readyWorkflows.length >= target.workflows_per_application
    };
  });
  const targetReadyApplications = applicationRows.filter((row) => row.ready_for_target);
  const taskManifestApplications = Array.isArray(taskManifest?.applications) ? taskManifest.applications.length : null;
  const blockers = [];
  if (plan.status !== 'ready-for-confirmatory') blockers.push(`plan status is ${plan.status}`);
  if (applications.length < target.application_count) blockers.push(`application registry has ${applications.length}/${target.application_count} declared applications`);
  if (readyApplications.length < target.application_count) blockers.push(`only ${readyApplications.length}/${target.application_count} applications have admitted/frozen status`);
  if (targetReadyApplications.length < target.application_count) blockers.push(`only ${targetReadyApplications.length}/${target.application_count} applications have ${target.workflows_per_application} admitted/frozen workflows`);
  if (taskManifestApplications !== null && taskManifestApplications < target.application_count) blockers.push(`task manifest has ${taskManifestApplications}/${target.application_count} application implementations`);
  if (plan.execution_policy?.refuse_on_missing_power_freeze) blockers.push('pilot variance and power freeze are not represented as complete in the current plan');
  return {
    target: {
      application_count: target.application_count,
      workflows_per_application: target.workflows_per_application,
      conditions: target.conditions.length,
      strategies: target.strategies.length,
      repetitions_per_cell: target.repetitions_per_cell,
      matched_cells: plan.derived_totals.matched_cells,
      execution_units: plan.derived_totals.execution_units
    },
    current: {
      declared_applications: applications.length,
      admitted_or_frozen_applications: readyApplications.length,
      target_ready_applications: targetReadyApplications.length,
      task_manifest_applications: taskManifestApplications,
      application_rows: applicationRows
    },
    ready_for_execution: blockers.length === 0,
    blockers
  };
}
