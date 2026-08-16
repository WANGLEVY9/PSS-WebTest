const contracts = Object.freeze({
  visual: {
    required: ['screenshot'],
    optional: ['viewport', 'cursor', 'timestamp'],
    forbidden: ['dom', 'pageStructure', 'accessibilityTree', 'selectors', 'network', 'applicationState', 'goldOracle', 'mutationLabel'],
    label: 'screenshot-only'
  },
  hybrid: {
    required: ['screenshot', 'pageStructure'],
    optional: ['viewport', 'cursor', 'timestamp', 'structureSchema'],
    forbidden: ['goldOracle', 'mutationLabel', 'applicationState'],
    label: 'screenshot-plus-structure'
  },
  playwright: {
    required: ['scriptId'],
    optional: ['browserName', 'browserVersion'],
    forbidden: ['runtimeModelPrompt', 'goldOracle', 'applicationState', 'mutationLabel'],
    label: 'scripted-locator'
  }
});

export function getObservationContract(arm) {
  const contract = contracts[arm];
  if (!contract) throw new Error(`Unknown arm: ${arm}`);
  return contract;
}

export function assertObservationContract(arm, observation) {
  const contract = getObservationContract(arm);
  const missing = contract.required.filter((field) => observation[field] === undefined);
  const explicitlyForbidden = contract.forbidden.filter((field) => observation[field] !== undefined);
  const allowed = new Set([...contract.required, ...contract.optional]);
  const undeclared = Object.keys(observation).filter((field) => !allowed.has(field));
  const leaked = [...new Set([...explicitlyForbidden, ...undeclared])].sort();
  if (missing.length || leaked.length) {
    throw new Error(JSON.stringify({ arm, missing, leaked }));
  }
  return { arm, observationContract: contract.label, admittedFields: Object.keys(observation).sort() };
}
