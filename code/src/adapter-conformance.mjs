import { createAgentAdapter } from './arms/agent-adapter.mjs';
import { assertObservationContract } from './arms/observation-contracts.mjs';
import { findConfiguration } from './configuration-registry.mjs';

const ARM_BY_FAMILY = Object.freeze({ visual: 'visual', hybrid: 'hybrid', scripted: 'playwright' });

function assertConfigurationFamily(configuration, expectedFamily) {
  if (configuration.family !== expectedFamily) {
    throw new Error(`configuration ${configuration.configuration_id} is ${configuration.family}, not ${expectedFamily}`);
  }
}

function assertConformanceExecution(result, family) {
  if (!result || typeof result !== 'object') throw new Error(`${family} conformance execution did not return a result object`);
  if (!['completed', 'timeout', 'test-failure'].includes(result.status)) throw new Error(`${family} conformance execution has unsupported status: ${result.status}`);
  if (!Number.isInteger(result.actions) || result.actions < 0) throw new Error(`${family} conformance execution must report a non-negative integer action count`);
  if (!Number.isInteger(result.retries) || result.retries < 0) throw new Error(`${family} conformance execution must report a non-negative integer retry count`);
}

/**
 * Execute a bounded, provider-free probe of a visual or hybrid adapter. The
 * supplied driver is normally a deterministic test double; a real-provider
 * invocation is deliberately outside this contract gate.
 */
export async function runAgentAdapterConformance({ registry, configurationId, driver, intent = 'Complete the conformance task.', maxSteps = 2 }) {
  const configuration = findConfiguration(registry, configurationId);
  if (!['visual', 'hybrid'].includes(configuration.family)) throw new Error(`configuration ${configurationId} is not an agent configuration`);
  const arm = ARM_BY_FAMILY[configuration.family];
  if (!driver || typeof driver.observe !== 'function' || typeof driver.decide !== 'function' || typeof driver.act !== 'function') {
    throw new TypeError('agent conformance driver must provide observe(), decide(), and act()');
  }

  let admittedObservation;
  const adapter = createAgentAdapter({ arm, maxSteps, driver: {
    async observe(context) {
      const observation = await driver.observe(context);
      admittedObservation = assertObservationContract(arm, observation);
      return observation;
    },
    async decide(context) { return driver.decide(context); },
    async act(action) { return driver.act(action); },
    getRetryCount: typeof driver.getRetryCount === 'function' ? () => driver.getRetryCount() : undefined
  } });
  const result = await adapter.run({ intent });
  const execution = { status: result.status, actions: result.actions.length, retries: result.retries };
  assertConformanceExecution(execution, configuration.family);
  return {
    schema_version: '0.1',
    configuration_id: configuration.configuration_id,
    family: configuration.family,
    arm,
    observation_contract: configuration.observation_contract,
    admitted_fields: admittedObservation?.admittedFields ?? [],
    execution,
    passed: result.status === 'completed'
  };
}

/**
 * Validate the equivalent boundary for a scripted-code adapter. A scripted
 * executor reports only its declared test artifact and aggregate execution
 * counters; it never receives evaluator state or an agent prompt.
 */
export async function runScriptedAdapterConformance({ registry, configurationId, observation, execute }) {
  const configuration = findConfiguration(registry, configurationId);
  assertConfigurationFamily(configuration, 'scripted');
  if (typeof execute !== 'function') throw new TypeError('scripted conformance execute must be a function');
  const admittedObservation = assertObservationContract('playwright', observation);
  const result = await execute();
  assertConformanceExecution(result, configuration.family);
  return {
    schema_version: '0.1',
    configuration_id: configuration.configuration_id,
    family: configuration.family,
    arm: ARM_BY_FAMILY[configuration.family],
    observation_contract: configuration.observation_contract,
    admitted_fields: admittedObservation.admittedFields,
    execution: result,
    passed: result.status === 'completed'
  };
}
