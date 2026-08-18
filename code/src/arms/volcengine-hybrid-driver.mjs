import { requireProviderConfig } from './agent-adapter.mjs';
import { assertObservationContract } from './observation-contracts.mjs';
import { parseDecision } from './volcengine-cua-driver.mjs';

function asDataUrl(screenshot) {
  if (typeof screenshot !== 'string' || screenshot.length === 0) throw new TypeError('screenshot must be a non-empty string');
  return screenshot.startsWith('data:image/') ? screenshot : `data:image/png;base64,${screenshot}`;
}

/**
 * Volcengine hybrid arm: screenshot plus an accessibility/page structure.
 * The structure is validated at the boundary so evaluator/application fields
 * cannot be smuggled into the provider prompt. This is a provider smoke
 * driver; it does not itself establish confirmatory SUT evidence.
 */
export function createVolcengineHybridDriver({ env = process.env, observeHybrid, executeAction, fetchImpl = fetch, timeoutMs = 60000 } = {}) {
  const config = requireProviderConfig(env);
  if (config.provider !== 'volcengine') throw new Error(`Unsupported CUA provider for this driver: ${config.provider}`);
  const apiKey = env.CUA_API_KEY.trim();
  if (typeof observeHybrid !== 'function' || typeof executeAction !== 'function') throw new TypeError('observeHybrid and executeAction are required');
  const baseUrl = (env.CUA_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/$/, '');
  const coordinateMode = env.CUA_COORDINATE_MODE || 'normalized_1000';
  const actionHistory = [];

  return {
    async observe() {
      const observation = await observeHybrid();
      assertObservationContract('hybrid', observation);
      // Return only fields admitted by the contract; do not retain accidental
      // evaluator/application properties supplied by an upstream collector.
      const admitted = {
        screenshot: asDataUrl(observation.screenshot),
        pageStructure: observation.pageStructure
      };
      for (const field of ['viewport', 'cursor', 'timestamp', 'structureSchema']) {
        if (observation[field] !== undefined) admitted[field] = observation[field];
      }
      return admitted;
    },
    async decide({ intent, observation, step }) {
      assertObservationContract('hybrid', observation);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const structure = JSON.stringify(observation.pageStructure);
        const response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST', signal: controller.signal,
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: config.model, temperature: 0, max_tokens: 160,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: [
              { type: 'text', text: `You are a UI testing agent. Task: ${intent}\nStep: ${step}\nRecent actions: ${JSON.stringify(actionHistory.slice(-4))}\nAccessibility/page structure (use only this declared structure and the screenshot): ${structure}\nReturn ONLY one JSON object. Valid forms are exactly: {"type":"done","verdict":"pass"}; {"type":"action","action":{"type":"click","x":0,"y":0}}; {"type":"action","action":{"type":"double_click","x":0,"y":0}}; {"type":"action","action":{"type":"type","text":"apple"}}; {"type":"action","action":{"type":"keypress","key":"ENTER"}}; {"type":"action","action":{"type":"scroll","delta_y":400}}; or {"type":"action","action":{"type":"wait","ms":500}}. Pointer coordinates must be 0-1000 relative coordinates; never output selectors or evaluator fields.` },
              { type: 'image_url', image_url: { url: asDataUrl(observation.screenshot) } }
            ] }]
          })
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(`CUA API request failed (${response.status}): ${payload?.error?.message || 'unknown error'}`);
        const decision = parseDecision(payload?.choices?.[0]?.message?.content || '');
        if (decision.type === 'action' && coordinateMode === 'normalized_1000' && ['click', 'double_click'].includes(decision.action.type)) {
          decision.action = { ...decision.action, x: Math.round(decision.action.x * 1280 / 1000), y: Math.round(decision.action.y * 720 / 1000), coordinate_mode: 'pixels' };
        }
        actionHistory.push(decision.type === 'action' ? decision.action : decision);
        return decision;
      } finally { clearTimeout(timer); }
    },
    async act(action) { return executeAction(action); }
  };
}
