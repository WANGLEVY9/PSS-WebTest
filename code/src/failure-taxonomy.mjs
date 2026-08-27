/**
 * Stable pilot failure taxonomy.  Categories describe the first observable
 * failure boundary; they do not infer an unobserved model-internal cause.
 */
export function classifyAgentFailure({ failure = null, result = null, oraclePassed = false } = {}) {
  if (failure) {
    const message = String(failure.message ?? failure).toLowerCase();
    const name = String(failure.name ?? '').toLowerCase();
    if (name.includes('abort') || /\b(aborted|timeout|timed out|wall-time budget)\b/.test(message)) return 'provider-timeout';
    if (/repeated non-progressing click/.test(message)) return 'grounding-loop';
    if (/api request failed/.test(message)) return 'provider-api';
    if (/valid json|tool call|unsupported decision|unsupported action|empty or invalid/.test(message)) return 'provider-format';
    return 'execution';
  }
  if (result?.status === 'timeout') return 'agent-step-budget';
  if (result?.status === 'completed' && result?.emitted_verdict !== 'pass') {
    return oraclePassed ? 'termination-verdict' : 'agent-verdict';
  }
  if (!oraclePassed) return 'oracle';
  return null;
}
