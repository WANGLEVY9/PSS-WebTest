/**
 * Keep task effectiveness separate from protocol termination.  A model may
 * reach the independently verified postcondition and still fail to stop or
 * emit the required verdict; such a run is informative but not an admitted
 * matched cell.
 */
export function deriveAgentOutcome({ failure = null, result = null, oraclePassed = false } = {}) {
  const taskStateReached = oraclePassed === true;
  const protocolCompleted = !failure && result?.status === 'completed' && result?.emitted_verdict === 'pass';
  return {
    taskStateReached,
    protocolCompleted,
    oracleOnlySuccess: taskStateReached && !protocolCompleted,
    cellPassed: taskStateReached && protocolCompleted
  };
}
