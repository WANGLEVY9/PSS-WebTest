/**
 * Keep task effectiveness separate from protocol termination.  A model may
 * reach the independently verified postcondition and still fail to stop or
 * emit the required verdict; such a run is informative but not an admitted
 * matched cell.
 */
export function normalizeAgentVerdict(verdict) {
  if (verdict === 'pass') return 'clean';
  return ['clean', 'fault', 'unknown', 'not-emitted'].includes(verdict) ? verdict : 'unknown';
}

export function deriveAgentOutcome({ failure = null, result = null, oraclePassed = false, expectedVerdict = 'clean' } = {}) {
  if (!['clean', 'fault'].includes(expectedVerdict)) throw new Error('expectedVerdict must be clean or fault');
  const taskStateReached = oraclePassed === true;
  const protocolCompleted = !failure && result?.status === 'completed' && normalizeAgentVerdict(result?.emitted_verdict) === expectedVerdict;
  return {
    taskStateReached,
    protocolCompleted,
    oracleOnlySuccess: taskStateReached && !protocolCompleted,
    cellPassed: taskStateReached && protocolCompleted
  };
}
