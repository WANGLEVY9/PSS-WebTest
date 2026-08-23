import { requireProviderConfig } from './agent-adapter.mjs';

const ACTION_TYPES = new Set(['click', 'double_click', 'type', 'keypress', 'scroll', 'wait']);

function asDataUrl(screenshot) {
  if (typeof screenshot !== 'string' || screenshot.length === 0) throw new TypeError('screenshot must be a non-empty string');
  return screenshot.startsWith('data:image/') ? screenshot : `data:image/png;base64,${screenshot}`;
}

function parseDecision(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('CUA model did not return valid JSON'); }
  if (parsed?.type === 'done') return { type: 'done', verdict: String(parsed.verdict || 'unknown') };
  if (parsed?.type !== 'action' || !ACTION_TYPES.has(parsed.action?.type)) throw new Error('CUA model returned an unsupported decision');
  const action = { ...parsed.action };
  if (['click', 'double_click'].includes(action.type)) {
    if (!Number.isFinite(action.x) || !Number.isFinite(action.y)) throw new Error('pointer action requires numeric x and y');
  }
  if (action.type === 'type' && typeof action.text !== 'string') throw new Error('type action requires text');
  if (action.type === 'keypress' && typeof action.key !== 'string') throw new Error('keypress action requires key');
  if (action.type === 'scroll' && !Number.isFinite(action.delta_y)) throw new Error('scroll action requires numeric delta_y');
  return { type: 'action', action };
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

export function createVolcengineCuaDriver({ env = process.env, observeScreenshot, executeAction, fetchImpl = fetch, timeoutMs = 15000, maxRetries = Number.parseInt(env.CUA_MAX_RETRIES ?? '1', 10) } = {}) {
  const config = requireProviderConfig(env);
  if (!['volcengine', 'aliyun'].includes(config.provider)) throw new Error(`Unsupported CUA provider for this driver: ${config.provider}`);
  const apiKey = env.CUA_API_KEY.trim();
  if (typeof observeScreenshot !== 'function' || typeof executeAction !== 'function') throw new TypeError('observeScreenshot and executeAction are required');
  const defaultBaseUrl = config.provider === 'aliyun'
    ? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    : 'https://ark.cn-beijing.volces.com/api/v3';
  const baseUrl = (env.CUA_BASE_URL || defaultBaseUrl).replace(/\/$/, '');
  const coordinateMode = env.CUA_COORDINATE_MODE || 'normalized_1000';
  const actionHistory = [];
  let retryCount = 0;

  return {
    async observe() {
      const screenshot = await observeScreenshot();
      return { screenshot: asDataUrl(screenshot) };
    },
    async decide({ intent, observation, step }) {
      const response = await fetchWithRetry(fetchImpl, `${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: config.model,
            temperature: 0,
            max_tokens: 160,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: [
              { type: 'text', text: `You are a UI testing agent. Task: ${intent}\nStep: ${step}\nActions already executed: ${JSON.stringify(actionHistory.slice(-4))}\nReturn ONLY one JSON object. Valid forms are exactly: {"type":"done","verdict":"pass"}; {"type":"action","action":{"type":"click","x":0,"y":0}}; {"type":"action","action":{"type":"double_click","x":0,"y":0}}; {"type":"action","action":{"type":"type","text":"apple"}}; {"type":"action","action":{"type":"keypress","key":"ENTER"}}; {"type":"action","action":{"type":"scroll","delta_y":400}}; or {"type":"action","action":{"type":"wait","ms":500}}. For pointer actions, output coordinates in the 0-1000 relative coordinate system (x and y each between 0 and 1000); the harness converts them to the 1280x720 screenshot viewport. Never omit required fields and do not invent DOM selectors.` },
              { type: 'image_url', image_url: { url: asDataUrl(observation.screenshot) } }
            ] }]
          })
        }, timeoutMs, maxRetries, () => { retryCount += 1; });
        const payload = await response.json();
        if (!response.ok) throw new Error(`CUA API request failed (${response.status}): ${payload?.error?.message || 'unknown error'}`);
        const decision = parseDecision(payload?.choices?.[0]?.message?.content || '');
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

export { parseDecision };
