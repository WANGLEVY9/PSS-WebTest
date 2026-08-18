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
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) {
    throw new TypeError(`Observation for ${arm} must be an object`);
  }
  const missing = contract.required.filter((field) => observation[field] === undefined);
  const explicitlyForbidden = contract.forbidden.filter((field) => observation[field] !== undefined);
  const allowed = new Set([...contract.required, ...contract.optional]);
  const undeclared = Object.keys(observation).filter((field) => !allowed.has(field));
  // Forbidden evaluator/application fields must not be smuggled inside the
  // structured page representation.  We intentionally report field names
  // (rather than values or paths) so logs cannot expose hidden state.
  const nestedForbidden = new Set();
  const visited = new WeakSet();
  function scan(value) {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    for (const [key, child] of Object.entries(value)) {
      if (contract.forbidden.includes(key)) nestedForbidden.add(key);
      scan(child);
    }
  }
  scan(observation);
  const leaked = [...new Set([...explicitlyForbidden, ...nestedForbidden, ...undeclared])].sort();
  if (missing.length || leaked.length) {
    throw new Error(JSON.stringify({ arm, missing, leaked }));
  }
  return { arm, observationContract: contract.label, admittedFields: Object.keys(observation).sort() };
}
