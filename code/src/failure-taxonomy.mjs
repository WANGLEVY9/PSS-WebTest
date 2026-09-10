/**
 * Stable pilot failure taxonomy.  Categories describe the first observable
 * failure boundary; they do not infer an unobserved model-internal cause.
 */
import { normalizeAgentVerdict } from './outcome-admission.mjs';

export function classifyAgentFailure({ failure = null, result = null, oraclePassed = false, expectedVerdict = 'clean' } = {}) {
  if (failure) {
    const message = String(failure.message ?? failure).toLowerCase();
    const name = String(failure.name ?? '').toLowerCase();
    // Playwright actionability failures can also contain "Timeout". They
    // are runner/SUT interaction boundaries, not provider latency failures.
    if (/locator\.|waiting for locator|element is not receiving|intercepts pointer|page\./.test(message)) return 'execution';
    if (/agent wall-time budget|wall-time budget/.test(message)) return 'agent-step-budget';
    if (name.includes('abort') || /\b(aborted|provider timeout|fetch timeout|timed out)\b/.test(message)) return 'provider-timeout';
    if (/repeated non-progressing click/.test(message)) return 'grounding-loop';
    if (/api request failed/.test(message)) return 'provider-api';
    if (/valid json|tool call|unsupported decision|unsupported action|empty or invalid/.test(message)) return 'provider-format';
    return 'execution';
  }
  if (result?.status === 'timeout') return 'agent-step-budget';
  if (result?.status === 'completed' && normalizeAgentVerdict(result?.emitted_verdict) !== expectedVerdict) {
    return oraclePassed ? 'termination-verdict' : 'agent-verdict';
  }
  if (!oraclePassed) return 'oracle';
  return null;
}
