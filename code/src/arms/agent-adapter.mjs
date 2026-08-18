import { assertObservationContract } from './observation-contracts.mjs';

export const AGENT_ARMS = Object.freeze(['visual', 'hybrid']);

export class AgentProviderNotConfiguredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AgentProviderNotConfiguredError';
  }
}

export function requireProviderConfig(env = process.env) {
  const provider = env.CUA_PROVIDER?.trim();
  const model = env.CUA_MODEL?.trim();
  const apiKey = env.CUA_API_KEY?.trim();
  const missing = [
    ['CUA_PROVIDER', provider],
    ['CUA_MODEL', model],
    ['CUA_API_KEY', apiKey]
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) {
    throw new AgentProviderNotConfiguredError(`Agent provider is not configured; missing ${missing.join(', ')}`);
  }
  return { provider, model, configured: true };
}

export function createAgentAdapter({ arm, driver, maxSteps = 30 }) {
  if (!AGENT_ARMS.includes(arm)) throw new Error(`Agent adapter only supports ${AGENT_ARMS.join(' and ')} arms`);
  if (!driver || typeof driver.observe !== 'function' || typeof driver.act !== 'function') {
    throw new TypeError('Agent driver must provide observe() and act(action) functions');
  }
  if (!Number.isInteger(maxSteps) || maxSteps < 1) throw new RangeError('maxSteps must be a positive integer');

  return {
    async run({ intent, onStep = () => {} }) {
      if (!intent?.trim()) throw new Error('A non-empty natural-language intent is required');
      const startedAt = Date.now();
      const actions = [];
      let emittedVerdict = 'not-emitted';
      for (let step = 0; step < maxSteps; step += 1) {
        const observation = await driver.observe({ arm, step });
        const admittedObservation = assertObservationContract(arm, observation);
        const decision = await driver.decide({ intent, observation, step });
        if (!decision || decision.type === 'done') {
          emittedVerdict = decision?.verdict ?? 'unknown';
          break;
        }
        if (decision.type !== 'action') throw new Error(`Driver decision at step ${step} must be action or done`);
        await driver.act(decision.action);
        actions.push({ step, action: decision.action, observation_contract: admittedObservation.observationContract });
        await onStep({ step, observation: admittedObservation, action: decision.action });
      }
      const reachedStepLimit = actions.length >= maxSteps;
      return {
        status: reachedStepLimit ? 'timeout' : 'completed',
        emitted_verdict: emittedVerdict,
        actions,
        retries: typeof driver.getRetryCount === 'function' ? driver.getRetryCount() : 0,
        wall_time_ms: Date.now() - startedAt,
        max_steps: maxSteps
      };
    }
  };
}
