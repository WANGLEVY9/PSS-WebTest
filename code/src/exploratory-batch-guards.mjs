export function evaluateBatchAuthorisation({ manifest, currentProfile, executeFlag, maxProviderRequests, maxWallMinutes, selectedBlockCount }) {
  const errors = [];
  if (executeFlag !== '1') errors.push('Set PSS_BATCH_EXECUTE=1 to authorize execution.');
  if (!manifest || manifest.status !== 'prepared-not-authorized-for-execution') errors.push('Batch manifest is not in the prepared-not-authorized-for-execution state.');
  if (!manifest?.provider_model_stratum || manifest.provider_model_stratum !== currentProfile) errors.push('The current provider/model profile does not match the prepared manifest.');
  if (!Number.isInteger(selectedBlockCount) || selectedBlockCount < 1) errors.push('At least one matched block must be selected.');
  const perBlock = manifest?.guardrails?.max_agent_decisions_per_block;
  const requiredRequests = Number.isInteger(perBlock) && Number.isInteger(selectedBlockCount) ? perBlock * selectedBlockCount : null;
  if (!Number.isInteger(maxProviderRequests) || maxProviderRequests < (requiredRequests ?? Infinity)) errors.push(`PSS_BATCH_MAX_PROVIDER_REQUESTS must be an integer of at least ${requiredRequests ?? 'the selected request budget'}.`);
  if (!Number.isInteger(maxWallMinutes) || maxWallMinutes < 1) errors.push('PSS_BATCH_MAX_WALL_MINUTES must be a positive integer.');
  return { errors, requiredRequests };
}

export function classifyControllerBoundary({ code, stdout, stderr }) {
  const combined = `${stdout ?? ''}\n${stderr ?? ''}`.toLowerCase();
  return {
    providerFailure: code !== 0 && (/failure_category[^\n]{0,100}provider/.test(combined) || /provider[ _-]?(abort|error|timeout|rate)/.test(combined) || /429|rate limit/.test(combined)),
    resetFailure: /"reset_ok":false/.test(combined) || /failure_category[^\n]{0,100}environment/.test(combined),
    fullThreeArmRecord: ['"arm":"visual"', '"arm":"hybrid"', '"arm":"playwright"'].every((needle) => combined.includes(needle))
  };
}
