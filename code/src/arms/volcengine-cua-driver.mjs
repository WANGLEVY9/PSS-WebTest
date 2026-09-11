import crypto from 'node:crypto';
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
        target_id: { type: 'string', pattern: '^c[0-9]{1,3}$' },
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

// Ark Responses API uses the same function schema without the OpenAI
// Chat-Completions `function` wrapper. Keep both shapes explicit so the
// provider mode is auditable and the existing chat path remains unchanged.
const RESPONSES_UI_ACTION_TOOL = {
  type: 'function',
  name: 'ui_action',
  description: UI_ACTION_TOOL.function.description,
  parameters: UI_ACTION_TOOL.function.parameters
};

function asDataUrl(screenshot) {
  if (typeof screenshot !== 'string' || screenshot.length === 0) throw new TypeError('screenshot must be a non-empty string');
  return screenshot.startsWith('data:image/') ? screenshot : `data:image/png;base64,${screenshot}`;
}

function screenshotDigest(screenshot) {
  return crypto.createHash('sha256').update(asDataUrl(screenshot)).digest('hex');
}

function providerResponseSummary({ env, response, payload, step, attempt, ok = false, error = null } = {}) {
  const message = payload?.choices?.[0]?.message ?? {};
  const content = typeof message.content === 'string' ? message.content : '';
  const toolArguments = typeof message.tool_calls?.[0]?.function?.arguments === 'string'
    ? message.tool_calls[0].function.arguments : '';
  const responseTool = payload?.output?.find?.((item) => item?.type === 'function_call');
  const responseText = typeof payload?.output_text === 'string' ? payload.output_text : '';
  const normalizedContent = content || responseText;
  const normalizedArguments = toolArguments || (typeof responseTool?.arguments === 'string' ? responseTool.arguments : '');
  const summary = {
    provider: env.CUA_PROVIDER ?? null,
    model: env.CUA_MODEL ?? null,
    step: Number.isInteger(step) ? step : null,
    attempt: Number.isInteger(attempt) ? attempt : null,
    http_status: Number.isInteger(response?.status) ? response.status : null,
    ok: ok === true,
    finish_reason: typeof payload?.choices?.[0]?.finish_reason === 'string' ? payload.choices[0].finish_reason : (typeof payload?.status === 'string' ? payload.status : null),
    has_text_content: normalizedContent.length > 0,
    has_tool_call: Boolean(message.tool_calls?.length || responseTool),
    content_length: normalizedContent.length,
    content_digest: normalizedContent ? crypto.createHash('sha256').update(normalizedContent).digest('hex') : null,
    tool_name: typeof message.tool_calls?.[0]?.function?.name === 'string' ? message.tool_calls[0].function.name : (typeof responseTool?.name === 'string' ? responseTool.name : null),
    arguments_length: normalizedArguments.length,
    arguments_digest: normalizedArguments ? crypto.createHash('sha256').update(normalizedArguments).digest('hex') : null
  };
  if (error) summary.error = { name: error.name, message: error.message };
  return summary;
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

function parseDecision(text, { coordinateMode = 'normalized_1000', allowTargetId = false } = {}) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('CUA model did not return valid JSON'); }
  if (parsed?.type === 'done') return { type: 'done', verdict: String(parsed.verdict || 'unknown') };
  if (parsed?.type !== 'action' || !ACTION_TYPES.has(parsed.action?.type)) throw new Error('CUA model returned an unsupported decision');
  const rawAction = parsed.action;
  // qwen3.7-flash sometimes serializes a visual click point as
  // {"x":[x,y],"y":null} even when asked for separate coordinate fields.
  // This is an unambiguous, bounded equivalent of x/y only when the tuple has
  // exactly two integer members and there is no competing y value. All other
  // non-scalar coordinate representations remain invalid below.
  const tuplePoint = Array.isArray(rawAction.x)
    && rawAction.x.length === 2
    && rawAction.x.every(Number.isInteger)
    && (rawAction.y === null || rawAction.y === undefined);
  const integerToken = (value) => {
    if (Number.isInteger(value)) return value;
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? parsed : value;
    }
    return value;
  };
  const normalizedRawAction = tuplePoint
    ? { ...rawAction, x: integerToken(rawAction.x[0]), y: integerToken(rawAction.x[1]) }
    : { ...rawAction, x: integerToken(rawAction.x), y: integerToken(rawAction.y) };
  const action = { type: normalizedRawAction.type };
  for (const field of ['x', 'y', 'text', 'key', 'delta_y', 'ms']) {
    if (normalizedRawAction[field] !== undefined) action[field] = normalizedRawAction[field];
  }
  if (allowTargetId && normalizedRawAction.target_id !== undefined) action.target_id = normalizedRawAction.target_id;
  if (action.target_id !== undefined && !allowTargetId) throw new Error('target_id is not admitted for this observation contract');
  if (['click', 'double_click'].includes(action.type) && action.target_id !== undefined) {
    if (!/^c\d{1,3}$/.test(action.target_id)) throw new Error('target_id must be a bounded candidate id');
  } else if (['click', 'double_click'].includes(action.type)) {
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
  if (options.allowTargetId && candidate.target_id !== undefined) action.target_id = candidate.target_id;
  // Reuse the normal schema and bounds validation after translating the
  // provider's function-call arguments to the common arm representation.
  return parseDecision(JSON.stringify({ type: 'action', action }), options);
}

function parseProviderDecision(payload, options = {}) {
  const responseToolCall = payload?.output?.find?.((item) => item?.type === 'function_call');
  if (responseToolCall) {
    return parseToolDecision({ function: { name: responseToolCall.name, arguments: responseToolCall.arguments } }, options);
  }
  if (Array.isArray(payload?.output)) {
    const text = typeof payload.output_text === 'string'
      ? payload.output_text
      : payload.output.flatMap((item) => item?.content ?? []).find((item) => typeof item?.text === 'string')?.text ?? '';
    return parseDecision(text, options);
  }
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

export function createVolcengineCuaDriver({ env = process.env, observeScreenshot, executeAction, onProviderResponse, fetchImpl = fetch, timeoutMs = 15000, maxRetries = Number.parseInt(env.CUA_MAX_RETRIES ?? '1', 10), coordinateMode = env.CUA_COORDINATE_MODE ?? 'normalized_1000', wallTimeoutMs = Number.parseInt(env.CUA_AGENT_WALL_TIMEOUT_MS ?? '0', 10), doneVerdicts = ['pass'] } = {}) {
  const config = requireProviderConfig(env);
  if (!['volcengine', 'aliyun', 'deepseek'].includes(config.provider)) throw new Error(`Unsupported CUA provider for this driver: ${config.provider}`);
  const apiKey = env.CUA_API_KEY.trim();
  if (typeof observeScreenshot !== 'function' || typeof executeAction !== 'function') throw new TypeError('observeScreenshot and executeAction are required');
  if (!Array.isArray(doneVerdicts) || doneVerdicts.length === 0 || doneVerdicts.some((verdict) => !['pass', 'clean', 'fault'].includes(verdict))) throw new TypeError('doneVerdicts must contain pass, clean, or fault labels');
  const defaultBaseUrl = config.provider === 'aliyun'
    ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    : config.provider === 'deepseek'
    ? 'https://api.deepseek.com'
    : 'https://ark.cn-beijing.volces.com/api/v3';
  const baseUrl = (env.CUA_BASE_URL || defaultBaseUrl).replace(/\/$/, '');
  const maxOutputTokens = Number.parseInt(env.CUA_MAX_OUTPUT_TOKENS ?? '512', 10);
  const aliyunActionMode = env.CUA_ALIYUN_ACTION_MODE ?? 'tool';
  const deepseekActionMode = env.CUA_DEEPSEEK_ACTION_MODE ?? 'tool';
  const volcengineActionMode = env.CUA_VOLCENGINE_ACTION_MODE ?? 'json';
  if (config.provider === 'aliyun' && !['tool', 'json'].includes(aliyunActionMode)) {
    throw new Error('CUA_ALIYUN_ACTION_MODE must be tool or json');
  }
  if (config.provider === 'deepseek' && !['tool', 'json'].includes(deepseekActionMode)) {
    throw new Error('CUA_DEEPSEEK_ACTION_MODE must be tool or json');
  }
  if (config.provider === 'volcengine' && !['tool', 'json'].includes(volcengineActionMode)) {
    throw new Error('CUA_VOLCENGINE_ACTION_MODE must be tool or json');
  }
  const actionMode = config.provider === 'aliyun'
    ? aliyunActionMode
    : config.provider === 'deepseek'
    ? deepseekActionMode
    : volcengineActionMode;
  // Qwen3-VL's JSON mode is not reliable when thinking is enabled.  Alibaba's
  // OpenAI-compatible endpoint also prefers max_completion_tokens; keep the
  // Volcengine request shape unchanged for backward compatibility.
  const generationOptions = config.provider === 'aliyun'
    ? { max_completion_tokens: maxOutputTokens, enable_thinking: false, presence_penalty: 1.5 }
    : config.provider === 'deepseek'
    ? { max_tokens: maxOutputTokens, thinking: { type: 'disabled' } }
    : { max_tokens: maxOutputTokens };
  const maxDecisionRetries = Number.parseInt(env.CUA_MAX_DECISION_RETRIES ?? (['aliyun', 'deepseek'].includes(config.provider) ? '1' : '0'), 10);
  const responsesMode = config.provider === 'volcengine' && (env.CUA_VOLCENGINE_API_MODE ?? 'chat') === 'responses';
  const actionHistory = [];
  let lastAcceptedPointer = null;
  let retryCount = 0;
  const wallDeadline = Number.isFinite(wallTimeoutMs) && wallTimeoutMs > 0 ? Date.now() + wallTimeoutMs : null;

  return {
    async observe(context = {}) {
      const screenshot = await observeScreenshot(context);
      return { screenshot: asDataUrl(screenshot) };
    },
    async decide({ intent, observation, step }) {
      if (wallDeadline && Date.now() >= wallDeadline) throw new Error('agent wall-time budget exceeded');
      const currentObservationDigest = screenshotDigest(observation.screenshot);
      const coordinateInstruction = coordinateBounds(coordinateMode).instruction;
      const formatInstruction = actionMode === 'tool'
        ? 'Call the ui_action function exactly once. Do not emit textual JSON, markdown, or explanations. For a type action, use the exact single-line literal from the task and immediately finish the function arguments.'
        : `Return ONLY one complete JSON object, with no markdown or explanation. The outer object MUST use exactly one of these forms: {"type":"done","verdict":"${doneVerdicts[0]}"}; or {"type":"action","action":{"type":"click","x":330,"y":512}}; or {"type":"action","action":{"type":"double_click","x":330,"y":512}}; or {"type":"action","action":{"type":"type","text":"apple"}}; or {"type":"action","action":{"type":"keypress","key":"ENTER"}}; or {"type":"action","action":{"type":"scroll","delta_y":400}}; or {"type":"action","action":{"type":"wait","ms":500}}. Allowed done verdicts: ${doneVerdicts.join(', ')}.`;
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
        const retryBlockedClickInstruction = actionHistory.at(-1)?.type === 'rejected_click'
          ? 'The previous click was rejected because the screenshot did not change. Re-plan from the current screenshot and choose a different visible target from the task sequence; do not reuse that coordinate.'
          : blockedClickInstruction;
        const retryRepeatedClickInstruction = actionHistory.at(-1)?.type === 'rejected_click'
          ? 'The current page did not advance after the previous click. Do not click the same navigation or sidebar control again; inspect the current screenshot and select the next task-specific control, or type into the focused field.'
          : repeatedClickInstruction;
        const retryInstruction = decisionAttempt > 0
          ? 'The previous provider response had empty or invalid action arguments. Retry now with exactly one complete ui_action call and all required arguments.'
          : '';
        const instructionText = `You are a UI testing agent. Task: ${intent}\nStep: ${step}\nActions already executed: ${JSON.stringify(actionHistory.slice(-4))}\n${editorFollowupInstruction}\n${typingGuardInstruction}\n${retryRepeatedClickInstruction}\n${retryBlockedClickInstruction}\n${retryInstruction}\n${formatInstruction} Never output a top-level click/type/keypress object. Never use a key named y=; the coordinate keys are exactly x and y. For type actions, text must be one single-line literal from the task, with no newline characters, no padding, and at most 200 characters. For pointer actions, use ${coordinateInstruction}; never output decimal coordinates. Never omit required fields and do not invent DOM selectors.`;
        const requestBody = responsesMode
          ? {
              model: config.model,
              max_output_tokens: maxOutputTokens,
              input: [{ type: 'message', role: 'user', content: [
                { type: 'input_text', text: instructionText },
                { type: 'input_image', image_url: asDataUrl(observation.screenshot) }
              ] }]
            }
          : {
              model: config.model,
              temperature: 0,
              ...generationOptions,
              messages: [{ role: 'user', content: [
                { type: 'text', text: instructionText },
                { type: 'image_url', image_url: { url: asDataUrl(observation.screenshot) } }
              ] }]
            };
        if (actionMode === 'tool') {
          requestBody.tools = [responsesMode ? RESPONSES_UI_ACTION_TOOL : UI_ACTION_TOOL];
          if (!responsesMode) requestBody.tool_choice = { type: 'function', function: { name: 'ui_action' } };
        } else if (!responsesMode) {
          requestBody.response_format = { type: 'json_object' };
        }
        let response;
        let payload;
        let providerRecorded = false;
        const emitProviderSummary = (ok, error = null) => {
          if (providerRecorded) return;
          providerRecorded = true;
          try { onProviderResponse?.(providerResponseSummary({ env, response, payload, step, attempt: decisionAttempt, ok, error })); } catch { /* instrumentation is non-fatal */ }
        };
        try {
          response = await fetchWithRetry(fetchImpl, `${baseUrl}/${responsesMode ? 'responses' : 'chat/completions'}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
            body: JSON.stringify(requestBody)
          }, timeoutMs, maxRetries, () => { retryCount += 1; });
          payload = await response.json();
          if (!response.ok) throw new Error(`CUA API request failed (${response.status}): ${payload?.error?.message || 'unknown error'}`);
          decision = parseProviderDecision(payload, { coordinateMode });
          const repeatsPointer = decision.type === 'action' && decision.action.type === 'click' && lastAcceptedPointer
            && decision.action.x === lastAcceptedPointer.x && decision.action.y === lastAcceptedPointer.y;
          // A repeated coordinate is evidence of non-progress only when the
          // screenshot supplied for the new decision is byte-identical to the
          // screenshot before the prior accepted click.  Coordinate equality
          // alone is insufficient because a navigation or save transition can
          // place a different control at the same screen position.
          if (repeatsPointer && currentObservationDigest === lastAcceptedPointer.observationDigest) {
            throw new Error(`repeated non-progressing click at x=${decision.action.x} y=${decision.action.y}`);
          }
          emitProviderSummary(true);
          break;
        } catch (error) {
          emitProviderSummary(false, error);
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
        if (decision.type === 'action' && decision.action.type === 'click') {
          lastAcceptedPointer = { x: decision.action.x, y: decision.action.y, observationDigest: currentObservationDigest };
        }
        if (decision.type === 'action' && ['click', 'double_click'].includes(decision.action.type)) {
          decision.action = toViewportPixels(decision.action, coordinateMode);
        }
        return decision;
    },
    async act(action) { return executeAction(action); },
    getRetryCount() { return retryCount; }
  };
}

export { parseDecision, parseToolDecision, parseProviderDecision, UI_ACTION_TOOL, RESPONSES_UI_ACTION_TOOL };
