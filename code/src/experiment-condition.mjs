const CONDITIONS = new Set(['clean-stable', 'functional-fault', 'ui-evolution']);

export function resolveExperimentCondition(value = process.env.PSS_PILOT_CONDITION ?? 'clean-stable') {
  const condition = String(value).trim() || 'clean-stable';
  if (!CONDITIONS.has(condition)) throw new Error(`Unsupported PSS_PILOT_CONDITION: ${condition}`);
  return Object.freeze({
    condition,
    expectedVerdict: condition === 'functional-fault' ? 'fault' : 'clean',
    isFault: condition === 'functional-fault',
    isEvolution: condition === 'ui-evolution'
  });
}

export { CONDITIONS };
