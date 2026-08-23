import { requireProviderConfig } from './agent-adapter.mjs';

const ACTION_TYPES = new Set(['click', 'double_click', 'type', 'keypress', 'scroll', 'wait']);
const TOOL_ACTION_TYPES = new Set([...ACTION_TYPES, 'done']);

const UI_ACTION_TOOL = {
  type: 'function',
  function: {
    name: 'ui_action',
    description: 'Return exactly one next browser action for the UI testing task.',
    parameters: {
      type: 'object',
      properties: {
        action_type: { type: 'string', enum: [...TOOL_ACTION_TYPES] },
        x: { type: 'integer', minimum: 0, maximum: 2000 },
        y: { type: 'integer', minimum: 0, maximum: 2000 },
        text: { type: 'string', maxLength: 200 },
        key: { type: 'string' },
        delta_y: { type: 'integer' },
        ms: { type: 'integer', minimum: 100, maximum: 3000 },
        verdict: { type: 'string' }
      },
      required: ['action_type'],
      additionalProperties: false
    }
  }
};

function asDataUrl(screenshot) {
  if (typeof screenshot !== 'string' || screenshot.length === 0) throw new TypeError('screenshot must be a non-empty string');
  return screenshot.startsWith('data:image/') ? screenshot : `data:image/png;base64,${screenshot}`;
}

function coordinateBounds(coordinateMode) {
  if (coordinateMode === 'pixels') return { maxX: 1280, maxY: 720, instruction: 'pixel coordinates: integer x from 0 to 1280 and integer y from 0 to 720' };
  if (coordinateMode === 'auto') return { maxX: 1280, maxY: 1000, instruction: 'pixel coordinates x=0..1280,y=0..720; if y>720 or x>1000, use normalized x/y=0..1000 so the harness can convert it' };
  return { maxX: 1000, maxY: 1000, instruction: 'normalized coordinates: integer x and y from 0 to 1000' };
}

function toViewportPixels(action, coordinateMode) {
  const normalized = coordinateMode === 'normalized_1000' || (coordinateMode === 'auto' && (action.x > 1000 || action.y > 720));
  return normalized
    ? { ...action, x: Math.round(action.x * 1280 / 1000), y: Math.round(action.y * 720 / 1000), coordinate_mode: 'pixels' }
    : action;
}

function parseDecision(text, { coordinateMode = 'normalized_1000' } = {}) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('CUA model did not return valid JSON'); }
  if (parsed?.type === 'done') return { type: 'done', verdict: String(parsed.verdict || 'unknown') };
  if (parsed?.type !== 'action' || !ACTION_TYPES.has(parsed.action?.type)) throw new Error('CUA model returned an unsupported decision');
  const rawAction = parsed.action;
  const action = { type: rawAction.type };
  for (const field of ['x', 'y', 'text', 'key', 'delta_y', 'ms']) {
    if (rawAction[field] !== undefined) action[field] = rawAction[field];
  }
  if (['click', 'double_click'].includes(action.type)) {
    const bounds = coordinateBounds(coordinateMode);
    if (!Number.isInteger(action.x) || !Number.isInteger(action.y) || action.x < 0 || action.x > bounds.maxX || action.y < 0 || action.y > bounds.maxY) {
      throw new Error(`pointer action coordinates must be ${bounds.instruction} (received x=${String(action.x)} y=${String(action.y)})`);
    }
  }
  if (action.type === 'type' && typeof action.text !== 'string') throw new Error('type action requires text');
  if (action.type === 'type' && (action.text.length > 200 || /[\r\n]/.test(action.text))) throw new Error('type action text must be a single line of at most 200 characters');
  if (action.type === 'keypress' && typeof action.key !== 'string') throw new Error('keypress action requires key');
  if (action.type === 'scroll' && !Number.isFinite(action.delta_y)) throw new Error('scroll action requires numeric delta_y');
  return { type: 'action', action };
}

function parseToolDecision(toolCall, options = {}) {
  if (toolCall?.function?.name !== 'ui_action') throw new Error('CUA model returned an unsupported tool call');
  let args;
  try { args = JSON.parse(toolCall.function.arguments || ''); } catch { throw new Error('CUA model tool call did not contain valid JSON arguments'); }
  // Some OpenAI-compatible providers wrap function arguments in the textual
  // action schema despite the tool declaration. Accept only these equivalent
  // shapes, then pass them through the same strict common-schema validator.
  const nestedAction = args?.action && typeof args.action === 'object' ? args.action : null;
  const candidate = nestedAction
    ? { ...nestedAction, verdict: args.verdict ?? nestedAction.verdict, action_type: args.action_type ?? nestedAction.action_type ?? args.type ?? nestedAction.type ?? nestedAction.kind }
    : args;
  const actionType = candidate?.action_type ?? candidate?.type ?? candidate?.kind;
  if (!TOOL_ACTION_TYPES.has(actionType)) throw new Error(`CUA model tool call returned an unsupported action: ${String(actionType ?? 'missing')} (${JSON.stringify(args).slice(0, 300)})`);
  if (actionType === 'done') return { type: 'done', verdict: String(candidate.verdict || 'unknown') };
  const action = { type: actionType };
  for (const field of ['x', 'y', 'text', 'key', 'delta_y', 'ms']) {
    if (candidate[field] !== undefined) action[field] = candidate[field];
  }
  // Reuse the normal schema and bounds validation after translating the
  // provider's function-call arguments to the common arm representation.
  return parseDecision(JSON.stringify({ type: 'action', action }), options);
}

function parseProviderDecision(payload, options = {}) {
  const toolCall = payload?.choices?.[0]?.message?.tool_calls?.[0];
  return toolCall ? parseToolDecision(toolCall, options) : parseDecision(payload?.choices?.[0]?.message?.content || '', options);
}

async function fetchWithRetry(fetchImpl, url, init, timeoutMs, maxRetries, onRetry) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, { ...init, signal: controller.signal });
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) throw error;
      onRetry?.(error, attempt + 1);
    } finally { clearTimeout(timer); }
  }
  throw lastError;
}

export function createVolcengineCuaDriver({ env = process.env, observeScreenshot, executeAction, fetchImpl = fetch, timeoutMs = 15000, maxRetries = Number.parseInt(env.CUA_MAX_RETRIES ?? '1', 10), coordinateMode = env.CUA_COORDINATE_MODE ?? 'normalized_1000' } = {}) {
  const config = requireProviderConfig(env);
  if (!['volcengine', 'aliyun'].includes(config.provider)) throw new Error(`Unsupported CUA provider for this driver: ${config.provider}`);
  const apiKey = env.CUA_API_KEY.trim();
  if (typeof observeScreenshot !== 'function' || typeof executeAction !== 'function') throw new TypeError('observeScreenshot and executeAction are required');
  const defaultBaseUrl = config.provider === 'aliyun'
    ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    : 'https://ark.cn-beijing.volces.com/api/v3';
  const baseUrl = (env.CUA_BASE_URL || defaultBaseUrl).replace(/\/$/, '');
  const maxOutputTokens = Number.parseInt(env.CUA_MAX_OUTPUT_TOKENS ?? '512', 10);
  // Qwen3-VL's JSON mode is not reliable when thinking is enabled.  Alibaba's
  // OpenAI-compatible endpoint also prefers max_completion_tokens; keep the
  // Volcengine request shape unchanged for backward compatibility.
  const generationOptions = config.provider === 'aliyun'
    ? { max_completion_tokens: maxOutputTokens, enable_thinking: false, presence_penalty: 1.5 }
    : { max_tokens: maxOutputTokens };
  const maxDecisionRetries = Number.parseInt(env.CUA_MAX_DECISION_RETRIES ?? (config.provider === 'aliyun' ? '1' : '0'), 10);
  const actionHistory = [];
  let retryCount = 0;

  return {
    async observe() {
      const screenshot = await observeScreenshot();
      return { screenshot: asDataUrl(screenshot) };
    },
    async decide({ intent, observation, step }) {
      const coordinateInstruction = coordinateBounds(coordinateMode).instruction;
      const formatInstruction = config.provider === 'aliyun'
        ? 'Call the ui_action function exactly once. Do not emit textual JSON, markdown, or explanations. For a type action, use the exact single-line literal from the task and immediately finish the function arguments.'
        : 'Return ONLY one complete JSON object, with no markdown or explanation. The outer object MUST use exactly one of these forms: {"type":"done","verdict":"pass"}; or {"type":"action","action":{"type":"click","x":330,"y":512}}; or {"type":"action","action":{"type":"double_click","x":330,"y":512}}; or {"type":"action","action":{"type":"type","text":"apple"}}; or {"type":"action","action":{"type":"keypress","key":"ENTER"}}; or {"type":"action","action":{"type":"scroll","delta_y":400}}; or {"type":"action","action":{"type":"wait","ms":500}}.';
      const lastTwo = actionHistory.slice(-2);
      const blockedClickInstruction = actionHistory.at(-1)?.type === 'rejected_click'
        ? 'The previous candidate click was rejected because it repeated a non-progressing coordinate. Choose a different visible target; do not reuse that coordinate.'
        : '';
      const typingGuardInstruction = actionHistory.at(-1)?.type === 'type'
        ? 'The previous action typed text. Do not issue another type action into the same field; first click a different visible field or use a navigation key.'
        : '';
      const recentClicks = actionHistory.slice(-2);
      const repeatedClickInstruction = recentClicks.length === 2 && recentClicks.every((action) => action.type === 'click' && action.x === recentClicks[0].x && action.y === recentClicks[0].y)
        ? 'The last two clicks hit the same coordinate without advancing. Do not click that coordinate again; choose the next distinct visible control or type into the focused field.'
        : '';
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
            { type: 'text', text: `You are a UI testing agent. Task: ${intent}\nStep: ${step}\nActions already executed: ${JSON.stringify(actionHistory.slice(-4))}\n${editorFollowupInstruction}\n${typingGuardInstruction}\n${repeatedClickInstruction}\n${blockedClickInstruction}\n${retryInstruction}\n${formatInstruction} Never output a top-level click/type/keypress object. Never use a key named y=; the coordinate keys are exactly x and y. For type actions, text must be one single-line literal from the task, with no newline characters, no padding, and at most 200 characters. For pointer actions, use ${coordinateInstruction}; never output decimal coordinates. Never omit required fields and do not invent DOM selectors.` },
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
          decision = parseProviderDecision(payload, { coordinateMode });
          const previous = [...actionHistory].reverse().find((entry) => entry?.type === 'click' || entry?.type === 'rejected_click');
          if (decision.type === 'action' && decision.action.type === 'click' && previous && decision.action.x === previous.x && decision.action.y === previous.y) {
            throw new Error(`repeated non-progressing click at x=${decision.action.x} y=${decision.action.y}`);
          }
          break;
        } catch (error) {
          lastDecisionError = error;
          if (error.message.startsWith('repeated non-progressing click') && decision?.action) actionHistory.push({ type: 'rejected_click', x: decision.action.x, y: decision.action.y });
          if (decisionAttempt >= maxDecisionRetries) throw error;
          retryCount += 1;
        }
      }
      if (!decision) throw lastDecisionError || new Error('CUA provider did not return a decision');
        // Keep the model-facing history in the declared coordinate system.
        // The harness conversion to viewport pixels happens only after this
        // history entry is recorded, so repeated-click detection compares like
        // with like.
        actionHistory.push(decision.type === 'action' ? { ...decision.action } : decision);
        if (decision.type === 'action' && ['click', 'double_click'].includes(decision.action.type)) {
          decision.action = toViewportPixels(decision.action, coordinateMode);
        }
        return decision;
    },
    async act(action) { return executeAction(action); },
    getRetryCount() { return retryCount; }
  };
}

export { parseDecision, parseToolDecision, parseProviderDecision, UI_ACTION_TOOL };
