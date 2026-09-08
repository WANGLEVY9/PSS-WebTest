/**
 * Classify the persisted BookStack state without consulting an agent trace or
 * its self-reported verdict.  A functional-fault cell is successful only
 * when the known injected signature, rather than merely a failed clean
 * assertion, is independently observed.
 */
export function classifyBookStackPersistence({ candidateCount, cleanMatches, faultMatches, expectedVerdict = 'clean' } = {}) {
  for (const [name, value] of Object.entries({ candidateCount, cleanMatches, faultMatches })) {
    if (!Number.isInteger(value) || value < 0) throw new TypeError(`${name} must be a non-negative integer`);
  }
  if (!['clean', 'fault'].includes(expectedVerdict)) throw new Error('expectedVerdict must be clean or fault');

  let observedVerdict = 'unknown';
  if (candidateCount === 1 && cleanMatches === 1 && faultMatches === 0) observedVerdict = 'clean';
  if (candidateCount === 1 && cleanMatches === 0 && faultMatches === 1) observedVerdict = 'fault';

  return {
    candidate_count: candidateCount,
    clean_matches: cleanMatches,
    fault_matches: faultMatches,
    observed_verdict: observedVerdict,
    expected_verdict: expectedVerdict,
    passed: observedVerdict === expectedVerdict
  };
}
