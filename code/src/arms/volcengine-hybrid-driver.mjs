import { requireProviderConfig } from './agent-adapter.mjs';
import { assertObservationContract } from './observation-contracts.mjs';
import { parseProviderDecision, UI_ACTION_TOOL } from './volcengine-cua-driver.mjs';

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
async function fetchWithRetry(fetchImpl, url, init, timeoutMs, maxRetries, onRetry) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetchImpl(url, { ...init, signal: controller.signal }); }
    catch (error) { lastError = error; if (attempt >= maxRetries) throw error; onRetry?.(error, attempt + 1); }
    finally { clearTimeout(timer); }
  }
  throw lastError;
}

export function createVolcengineHybridDriver({ env = process.env, observeHybrid, executeAction, fetchImpl = fetch, timeoutMs = 15000, maxRetries = Number.parseInt(env.CUA_MAX_RETRIES ?? '1', 10) } = {}) {
  const config = requireProviderConfig(env);
  if (!['volcengine', 'aliyun'].includes(config.provider)) throw new Error(`Unsupported CUA provider for this driver: ${config.provider}`);
  const apiKey = env.CUA_API_KEY.trim();
  if (typeof observeHybrid !== 'function' || typeof executeAction !== 'function') throw new TypeError('observeHybrid and executeAction are required');
  const defaultBaseUrl = config.provider === 'aliyun'
    ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    : 'https://ark.cn-beijing.volces.com/api/v3';
  const baseUrl = (env.CUA_BASE_URL || defaultBaseUrl).replace(/\/$/, '');
  const maxOutputTokens = Number.parseInt(env.CUA_MAX_OUTPUT_TOKENS ?? '512', 10);
  // Qwen3-VL JSON mode can fail with thinking enabled.  Use Alibaba's
  // generation-limit field explicitly while preserving the Ark shape.
  const generationOptions = config.provider === 'aliyun'
    ? { max_completion_tokens: maxOutputTokens, enable_thinking: false, presence_penalty: 1.5 }
    : { max_tokens: maxOutputTokens };
  const coordinateMode = env.CUA_COORDINATE_MODE || 'normalized_1000';
  const maxDecisionRetries = Number.parseInt(env.CUA_MAX_DECISION_RETRIES ?? (config.provider === 'aliyun' ? '1' : '0'), 10);
  const actionHistory = [];
  let retryCount = 0;

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
      const structure = JSON.stringify(observation.pageStructure);
      const formatInstruction = config.provider === 'aliyun'
        ? 'Call the ui_action function exactly once. Do not emit textual JSON, markdown, or explanations. For a type action, use the exact single-line literal from the task and immediately finish the function arguments.'
        : 'Return ONLY one complete JSON object, with no markdown or explanation. The outer object MUST use exactly one of these forms: {"type":"done","verdict":"pass"}; or {"type":"action","action":{"type":"click","x":330,"y":512}}; or {"type":"action","action":{"type":"double_click","x":330,"y":512}}; or {"type":"action","action":{"type":"type","text":"apple"}}; or {"type":"action","action":{"type":"keypress","key":"ENTER"}}; or {"type":"action","action":{"type":"scroll","delta_y":400}}; or {"type":"action","action":{"type":"wait","ms":500}}.';
      const lastTwo = actionHistory.slice(-2);
      const editorFollowupInstruction = lastTwo.length === 2 && lastTwo[0].type === 'type' && lastTwo[1].type === 'click'
        ? 'The previous action typed the page title and the latest action clicked the content editor. Your next action MUST be a type action with the requested page content; do not click again.'
        : '';
      let decision;
      let lastDecisionError;
      for (let decisionAttempt = 0; decisionAttempt <= maxDecisionRetries; decisionAttempt += 1) {
        const retryInstruction = decisionAttempt > 0
          ? 'The previous provider response had empty or invalid action arguments. Retry now with exactly one complete ui_action call and all required arguments.'
          : '';
        const requestBody = {
          model: config.model,
          temperature: 0,
          ...generationOptions,
          messages: [{ role: 'user', content: [
            { type: 'text', text: `You are a UI testing agent. Task: ${intent}\nStep: ${step}\nRecent actions: ${JSON.stringify(actionHistory.slice(-4))}\nAccessibility/page structure (use only this declared structure and the screenshot): ${structure}\nThe controls list gives normalized center coordinates for visible links, buttons, textboxes, and the rich-text editor. In a new-page editor, always type the title into the Page Title textbox before clicking the Page content editor. After clicking the content editor once, the next action must be type with the requested content, not another click.\n${editorFollowupInstruction}\n${retryInstruction}\n${formatInstruction} Never output a top-level click/type/keypress object. Never use a key named y=; the coordinate keys are exactly x and y. For type actions, text must be one single-line literal from the task, with no newline characters, no padding, and at most 200 characters. Pointer x and y MUST be integer numbers from 0 to 1000; never output decimal coordinates. Never output selectors or evaluator fields.` },
            { type: 'image_url', image_url: { url: asDataUrl(observation.screenshot) } }
          ] }]
        };
        if (config.provider === 'aliyun') {
          requestBody.tools = [UI_ACTION_TOOL];
          requestBody.tool_choice = { type: 'function', function: { name: 'ui_action' } };
        } else {
          requestBody.response_format = { type: 'json_object' };
        }
        try {
          const response = await fetchWithRetry(fetchImpl, `${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
            body: JSON.stringify(requestBody)
          }, timeoutMs, maxRetries, () => { retryCount += 1; });
          const payload = await response.json();
          if (!response.ok) throw new Error(`CUA API request failed (${response.status}): ${payload?.error?.message || 'unknown error'}`);
          decision = parseProviderDecision(payload);
          break;
        } catch (error) {
          lastDecisionError = error;
          if (decisionAttempt >= maxDecisionRetries) throw error;
          retryCount += 1;
        }
      }
      if (!decision) throw lastDecisionError || new Error('CUA provider did not return a decision');
        if (decision.type === 'action' && coordinateMode === 'normalized_1000' && ['click', 'double_click'].includes(decision.action.type)) {
          decision.action = { ...decision.action, x: Math.round(decision.action.x * 1280 / 1000), y: Math.round(decision.action.y * 720 / 1000), coordinate_mode: 'pixels' };
        }
        actionHistory.push(decision.type === 'action' ? decision.action : decision);
        return decision;
    },
    async act(action) { return executeAction(action); },
    getRetryCount() { return retryCount; }
  };
}
