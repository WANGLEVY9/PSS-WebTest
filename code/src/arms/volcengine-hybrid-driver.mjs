import crypto from 'node:crypto';
import { requireProviderConfig } from './agent-adapter.mjs';
import { resolveProviderProtocol } from '../provider-profile.mjs';
import { assertObservationContract } from './observation-contracts.mjs';
import {
  parseProviderDecision,
  UI_ACTION_TOOL,
  RESPONSES_UI_ACTION_TOOL,
  SEMANTIC_UI_ACTION_TOOL,
  SEMANTIC_RESPONSES_UI_ACTION_TOOL
} from './volcengine-cua-driver.mjs';

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

export function createVolcengineHybridDriver({ env = process.env, observeHybrid, executeAction, onProviderResponse, fetchImpl = fetch, timeoutMs = 15000, maxRetries, coordinateMode, hybridActionMode = env.CUA_HYBRID_ACTION_MODE ?? 'coordinate', wallTimeoutMs = Number.parseInt(env.CUA_AGENT_WALL_TIMEOUT_MS ?? '0', 10), doneVerdicts = ['pass'] } = {}) {
  const config = requireProviderConfig(env);
  if (!['volcengine', 'aliyun', 'deepseek'].includes(config.provider)) throw new Error(`Unsupported CUA provider for this driver: ${config.provider}`);
  const apiKey = env.CUA_API_KEY.trim();
  if (typeof observeHybrid !== 'function' || typeof executeAction !== 'function') throw new TypeError('observeHybrid and executeAction are required');
  if (!Array.isArray(doneVerdicts) || doneVerdicts.length === 0 || doneVerdicts.some((verdict) => !['pass', 'clean', 'fault'].includes(verdict))) throw new TypeError('doneVerdicts must contain pass, clean, or fault labels');
  const defaultBaseUrl = config.provider === 'aliyun'
    ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    : config.provider === 'deepseek'
    ? 'https://api.deepseek.com'
    : 'https://ark.cn-beijing.volces.com/api/v3';
  const baseUrl = (env.CUA_BASE_URL || defaultBaseUrl).replace(/\/$/, '');
  // The provider protocol comes from the frozen profile manifest instead of an
  // implicit per-provider default.  The hybrid grounding mode is resolved
  // separately from the optimization profile by the matched runners.
  const protocol = resolveProviderProtocol({ env, provider: config.provider, model: config.model, arm: 'hybrid' });
  const maxOutputTokens = protocol.max_output_tokens ?? 512;
  const actionMode = protocol.action_mode;
  const responsesMode = config.provider === 'volcengine' && protocol.api_mode === 'responses';
  if (!['coordinate', 'semantic'].includes(hybridActionMode)) throw new Error('CUA_HYBRID_ACTION_MODE must be coordinate or semantic');
  if (maxRetries === undefined) maxRetries = protocol.max_retries ?? 1;
  if (coordinateMode === undefined) coordinateMode = protocol.coordinate_mode ?? 'normalized_1000';
  // Qwen3-VL JSON mode can fail with thinking enabled.  Use Alibaba's
  // generation-limit field explicitly while preserving the Ark shape.
  const generationOptions = config.provider === 'aliyun'
    ? { max_completion_tokens: maxOutputTokens, enable_thinking: false, presence_penalty: 1.5 }
    : config.provider === 'deepseek'
    ? { max_tokens: maxOutputTokens, thinking: { type: 'disabled' } }
    : { max_tokens: maxOutputTokens };
  const maxDecisionRetries = protocol.max_decision_retries ?? (['aliyun', 'deepseek'].includes(config.provider) ? 1 : 0);
  const actionHistory = [];
  const pointerIdentity = (action) => {
    if (typeof action?.target_id === 'string' && action.target_id.length > 0) return `target_id=${action.target_id}`;
    if (Number.isFinite(action?.x) && Number.isFinite(action?.y)) return `x=${action.x},y=${action.y}`;
    return null;
  };
  let lastAcceptedPointer = null;
  let observationSequence = 0;
  let lastObservedProgressToken = null;
  let retryCount = 0;
  const wallDeadline = Number.isFinite(wallTimeoutMs) && wallTimeoutMs > 0 ? Date.now() + wallTimeoutMs : null;

  return {
    async observe(context = {}) {
      const observation = await observeHybrid(context);
      assertObservationContract('hybrid', observation);
      // Return only fields admitted by the contract; do not retain accidental
      // evaluator/application properties supplied by an upstream collector.
      const admitted = {
        screenshot: asDataUrl(observation.screenshot),
        pageStructure: observation.pageStructure
      };
      for (const field of ['viewport', 'cursor', 'timestamp', 'structureSchema', 'progressToken']) {
        if (observation[field] !== undefined) admitted[field] = observation[field];
      }
      return admitted;
    },
    async decide({ intent, observation, step }) {
      assertObservationContract('hybrid', observation);
      if (wallDeadline && Date.now() >= wallDeadline) throw new Error('agent wall-time budget exceeded');
      const currentObservationDigest = screenshotDigest(observation.screenshot);
      const currentProgressToken = observation.progressToken ?? currentObservationDigest;
      // Preserve legitimate revisits after an intervening navigation.  A
      // same target on the same observation sequence is still rejected, but
      // an A -> B -> A transition is a new opportunity to act.
      if (currentProgressToken !== lastObservedProgressToken) {
        observationSequence += 1;
        lastObservedProgressToken = currentProgressToken;
      }
      const structure = JSON.stringify(observation.pageStructure);
      const coordinateInstruction = coordinateMode === 'pixels'
        ? 'pixel coordinates: integer x from 0 to 1280 and integer y from 0 to 720'
        : coordinateMode === 'auto'
        ? 'pixel coordinates x=0..1280,y=0..720; if y>720 or x>1000, use normalized x/y=0..1000 so the harness can convert it'
        : 'normalized coordinates: integer x and y from 0 to 1000';
      const groundingInstruction = hybridActionMode === 'semantic'
        ? 'For click and double_click actions, select exactly one visible candidate by its target_id (for example c12) from the declared page structure. Do not invent target IDs and do not output coordinates for a semantic action. The harness resolves target_id to the current visible control.'
        : `Use the declared normalized coordinates; ${coordinateInstruction}.`;
      const formatInstruction = actionMode === 'tool'
        ? 'Call the ui_action function exactly once. Do not emit textual JSON, markdown, or explanations. For a type action, use the exact single-line literal from the task and immediately finish the function arguments.'
        : `Return ONLY one complete JSON object, with no markdown or explanation. The outer object MUST use exactly one of these forms: {"type":"done","verdict":"${doneVerdicts[0]}"}; or {"type":"action","action":{"type":"click",${hybridActionMode === 'semantic' ? '"target_id":"c12"' : '"x":330,"y":512'}}}; or {"type":"action","action":{"type":"double_click",${hybridActionMode === 'semantic' ? '"target_id":"c12"' : '"x":330,"y":512'}}}; or {"type":"action","action":{"type":"type","text":"apple"}}; or {"type":"action","action":{"type":"keypress","key":"ENTER"}}; or {"type":"action","action":{"type":"scroll","delta_y":400}}; or {"type":"action","action":{"type":"wait","ms":500}}. Allowed done verdicts: ${doneVerdicts.join(', ')}.`;
      const lastTwo = actionHistory.slice(-2);
      const blockedClickInstruction = actionHistory.at(-1)?.type === 'rejected_click'
        ? 'The previous candidate click was rejected because it repeated a non-progressing target. Choose a different visible target; do not reuse that target.'
        : '';
      const typingGuardInstruction = actionHistory.at(-1)?.type === 'type'
        ? 'The previous action typed text. Do not issue another type action into the same field; first click a different visible field or use a navigation key.'
        : '';
      const recentClicks = actionHistory.slice(-2);
      const clickIdentity = (action) => pointerIdentity(action);
      const repeatedClickInstruction = recentClicks.length === 2 && recentClicks.every((action) => action.type === 'click' && clickIdentity(action) === clickIdentity(recentClicks[0]))
        ? 'The last two clicks hit the same coordinate without advancing. Do not click that coordinate again; choose the next distinct visible control or type into the focused field.'
        : '';
      const editorFollowupInstruction = lastTwo.length === 2 && lastTwo[0].type === 'type' && lastTwo[1].type === 'click'
        ? 'The previous action typed the page title and the latest action clicked the content editor. Your next action MUST be a type action with the requested page content; do not click again.'
        : '';
      const titleClearInstruction = lastAcceptedPointer?.interaction === 'type'
        && /title/i.test(lastAcceptedPointer.targetName ?? '')
        && ['click', 'rejected_click'].includes(actionHistory.at(-1)?.type)
        ? 'The Page Title textbox is focused and may contain default text. Your next action MUST be keypress with key CTRL+A; do not click another control and do not type until the field is selected.'
        : '';
      let decision;
      let lastDecisionError;
      for (let decisionAttempt = 0; decisionAttempt <= maxDecisionRetries; decisionAttempt += 1) {
        const retryTextboxClickInstruction = actionHistory.at(-1)?.type === 'rejected_click' && actionHistory.at(-1)?.interaction === 'type'
          ? 'The previous click targeted a textbox. The textbox is already focused; if it is the Page Title field, your next action MUST be keypress CTRL+A, followed by the exact requested type action.'
          : '';
        const retryInstruction = decisionAttempt > 0
          ? 'The previous provider response had empty or invalid action arguments. Retry now with exactly one complete ui_action call and all required arguments.'
          : '';
        const instructionText = `You are a UI testing agent. Task: ${intent}\nStep: ${step}\nRecent actions: ${JSON.stringify(actionHistory.slice(-4))}\nAccessibility/page structure (use only this declared structure and the screenshot): ${structure}\nThe controls list gives stable target_id values for visible links, buttons, and textboxes. A control with interaction=type requires a click followed by a type action; a control with interaction=click requires a click action. In a new-page editor, if the Page Title textbox already contains default text, click it, press CTRL+A, and only then type the exact requested title; never append to the default. After the title is correct, click the Page content editor once and on the very next action type the requested content, not another click.\n${editorFollowupInstruction}\n${titleClearInstruction}\n${typingGuardInstruction}\n${retryTextboxClickInstruction}\n${repeatedClickInstruction}\n${blockedClickInstruction}\n${retryInstruction}\n${groundingInstruction}\n${formatInstruction} Never output a top-level click/type/keypress object. For type actions, text must be one single-line literal from the task, with no newline characters, no padding, and at most 200 characters. Never output selectors or evaluator fields.`;
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
          const tool = hybridActionMode === 'semantic'
            ? (responsesMode ? SEMANTIC_RESPONSES_UI_ACTION_TOOL : SEMANTIC_UI_ACTION_TOOL)
            : (responsesMode ? RESPONSES_UI_ACTION_TOOL : UI_ACTION_TOOL);
          requestBody.tools = [tool];
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
          decision = parseProviderDecision(payload, { coordinateMode, allowTargetId: hybridActionMode === 'semantic' });
          const decisionIdentity = pointerIdentity(decision?.action);
          const repeatsPointer = decision.type === 'action' && decision.action.type === 'click' && lastAcceptedPointer
            && decisionIdentity !== null && decisionIdentity === lastAcceptedPointer.identity;
          // Compare target_id in semantic mode and coordinates in coordinate
          // mode. The observation digest still gates the rejection because
          // the same target/point can be valid after a visible transition.
          if (repeatsPointer
            && currentObservationDigest === lastAcceptedPointer.observationDigest
            && currentProgressToken === lastAcceptedPointer.progressToken
            && observationSequence === lastAcceptedPointer.observationSequence) {
            const repeatedTarget = decision.action.target_id && Array.isArray(observation.pageStructure?.controls)
              ? observation.pageStructure.controls.find((candidate) => candidate.target_id === decision.action.target_id)
              : null;
            if (repeatedTarget?.interaction === 'type' || repeatedTarget?.role === 'textbox') {
              throw new Error(`repeated non-progressing textbox click at ${decisionIdentity}`);
            }
            throw new Error(`repeated non-progressing click at ${decisionIdentity}`);
          }
          const titleNeedsClear = lastAcceptedPointer?.interaction === 'type'
            && /title/i.test(lastAcceptedPointer.targetName ?? '')
            && ['click', 'rejected_click'].includes(actionHistory.at(-1)?.type);
          const isCtrlA = decision.type === 'action'
            && decision.action.type === 'keypress'
            && String(decision.action.key).replaceAll('+', '').replaceAll('-', '').toUpperCase() === 'CTRL+A';
          if (titleNeedsClear && !isCtrlA) {
            throw new Error(`title textbox requires CTRL+A before typing at ${lastAcceptedPointer.identity}`);
          }
          emitProviderSummary(true);
          break;
        } catch (error) {
          emitProviderSummary(false, error);
          lastDecisionError = error;
          if ((error.message.startsWith('repeated non-progressing click') || error.message.startsWith('repeated non-progressing textbox click') || error.message.startsWith('title textbox requires CTRL+A')) && decision?.action) {
            const target = decision.action.target_id && Array.isArray(observation.pageStructure?.controls)
              ? observation.pageStructure.controls.find((candidate) => candidate.target_id === decision.action.target_id)
              : null;
            actionHistory.push({ ...decision.action, type: 'rejected_click', interaction: target?.interaction ?? null });
          }
          if (decisionAttempt >= maxDecisionRetries) throw error;
          retryCount += 1;
        }
      }
      if (!decision) throw lastDecisionError || new Error('CUA provider did not return a decision');
        actionHistory.push(decision.type === 'action' ? { ...decision.action } : decision);
        if (decision.type === 'action' && decision.action.type === 'click') {
          const target = decision.action.target_id && Array.isArray(observation.pageStructure?.controls)
            ? observation.pageStructure.controls.find((candidate) => candidate.target_id === decision.action.target_id)
            : null;
          lastAcceptedPointer = { identity: pointerIdentity(decision.action), interaction: target?.interaction ?? null, targetName: target?.name ?? null, observationDigest: currentObservationDigest, progressToken: currentProgressToken, observationSequence };
        }
        if (decision.type === 'action' && ['click', 'double_click'].includes(decision.action.type) && Number.isInteger(decision.action.x) && Number.isInteger(decision.action.y)) {
          const normalized = coordinateMode === 'normalized_1000' || (coordinateMode === 'auto' && (decision.action.x > 1000 || decision.action.y > 720));
          if (normalized) decision.action = { ...decision.action, x: Math.round(decision.action.x * 1280 / 1000), y: Math.round(decision.action.y * 720 / 1000), coordinate_mode: 'pixels' };
        }
        return decision;
    },
    async act(action) { return executeAction(action); },
    getRetryCount() { return retryCount; },
    getProtocolResolution() {
      return {
        profile_id: protocol.profile_id,
        profile_status: protocol.profile_status,
        frozen: protocol.frozen,
        action_mode: protocol.action_mode,
        action_mode_source: protocol.action_mode_source,
        api_mode: protocol.api_mode,
        api_mode_source: protocol.api_mode_source,
        coordinate_mode: protocol.coordinate_mode,
        max_output_tokens: protocol.max_output_tokens,
        max_decision_retries: protocol.max_decision_retries
      };
    }
  };
}
