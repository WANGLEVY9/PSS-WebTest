function gateState(workflow) {
  if (workflow.status === 'candidate') return 'implement workflow + reset + oracle + fault/evolution controls + three-arm pilot';
  if (workflow.status === 'pilot-only') return 'freeze v0.2 manifest/provenance; add fault/evolution controls and three-arm admission';
  if (workflow.status === 'admitted-pilot-only') return 'paired clean/fault pilot is complete; add a behavior-preserving evolution block and do not treat pilot admission as P1 eligibility';
  return 'manual status review required';
}

/** Build a transparent P1 workflow board without claiming that candidates are admitted. */
export function buildP1AdmissionBoard({ benchmarkMatrix, scalingPlan }) {
  const panel = scalingPlan.near_term_panels?.find((item) => item.id === 'P1-existing-sut-reference');
  if (!panel) throw new Error('P1-existing-sut-reference is missing from scaling plan');
  const requestedApplications = new Set(panel.applications);
  const rows = [];
  for (const application of benchmarkMatrix.applications ?? []) {
    if (!requestedApplications.has(application.id)) continue;
    const declaredWorkflows = application.workflows ?? [];
    if (declaredWorkflows.length < panel.workflows_per_application) throw new Error(`${application.id} must expose at least ${panel.workflows_per_application} P1 workflows`);
    // P1 remains the preregistered five-workflow reference panel. Additional
    // candidate workflows stay visible in the broader benchmark matrix but do
    // not silently change the P1 denominator.
    const workflows = declaredWorkflows.slice(0, panel.workflows_per_application);
    for (const workflow of workflows) {
      rows.push({
        application: application.id,
        workflow: workflow.id,
        complexity: workflow.complexity,
        current_status: workflow.status,
        oracle: `${workflow.oracle_authority} (${workflow.oracle_status})`,
        fault_slots: workflow.fault_slots.join(', '),
        evolution_slots: workflow.evolution_slots.join(', '),
        next_admission_gate: gateState(workflow)
      });
    }
  }
  if (rows.length !== panel.applications.length * panel.workflows_per_application) throw new Error('P1 board workflow count does not match scaling plan');
  return { panel, rows };
}

export function renderP1AdmissionBoard(board) {
  const lines = [
    '# Phase 2 P1 workflow admission board',
    '',
    `**Status:** pre-collection. The P1 design specifies ${board.panel.applications.length} SUTs × ${board.panel.workflows_per_application} workflows × ${board.panel.conditions.length} condition strata × ${board.panel.configuration_count} reference configurations × ${board.panel.repetitions} repetitions = **${board.panel.expected_runs} planned runs**.`,
    '',
    'No row below is confirmatory-eligible merely because it appears in the design. The board is an implementation checklist, not outcome data.',
    '',
    '| Application | Workflow | Complexity | Current status | Independent oracle | Fault slots | Evolution slots | Next admission gate |',
    '|---|---|---|---|---|---|---|---|'
  ];
  for (const row of board.rows) lines.push(`| ${row.application} | ${row.workflow} | ${row.complexity} | ${row.current_status} | ${row.oracle} | ${row.fault_slots} | ${row.evolution_slots} | ${row.next_admission_gate} |`);
  lines.push('', '## Required per-workflow evidence', '', '| Gate | Required evidence |', '|---|---|', '| Reset | A deterministic, auditable fresh-state check before every cell. |', '| Oracle | An independent clean/fault/unknown postcondition evaluator, never supplied to an agent. |', '| Fault | A declared fault positive control plus clean negative control; preserve ambiguous states as unknown. |', '| Evolution | A behavior-preservation invariant before a UI change enters the evolution stratum. |', '| Arms | All three reference configurations pass observation/provenance contracts and have a clean matched pilot. |');
  return `${lines.join('\n')}\n`;
}
