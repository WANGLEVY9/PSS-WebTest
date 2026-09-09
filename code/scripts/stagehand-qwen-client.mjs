import { createHash } from 'node:crypto';
import { LLMClient } from '@browserbasehq/stagehand';

/**
 * Minimal Stagehand LLMClient for Qwen's OpenAI-compatible endpoint.
 * Stagehand's built-in AI-SDK path serializes tool-result parts that the
 * DashScope compatible endpoint rejects. This client is intentionally scoped
 * to Stagehand's structured act/observe calls and keeps the response contract
 * fail-closed.
 */
export class StagehandQwenClient extends LLMClient {
  constructor({ modelName, apiKey, baseURL }) {
    super(modelName);
    this.type = 'openai';
    this.modelName = modelName;
    this.apiKey = apiKey;
    this.baseURL = baseURL.replace(/\/$/, '');
    this.hasVision = true;
    this.screenshotProvider = null;
    this.responseObserver = null;
  }

  setScreenshotProvider(provider) {
    this.screenshotProvider = provider;
  }

  setResponseObserver(observer) {
    this.responseObserver = observer;
  }

  async createChatCompletion({ options, retries = 1, logger }) {
    const messages = options.messages.map((message) => ({ role: message.role, content: message.content }));
    const schemaHint = options.response_model ? '\nReturn ONLY a valid JSON object with keys elementId, description, method, arguments, twoStep. elementId must match number-number; arguments must be an array of strings; twoStep must be boolean.' : '';
    if (schemaHint && typeof messages[messages.length - 1]?.content === 'string') messages[messages.length - 1].content += schemaHint;
    if (this.screenshotProvider && messages.length > 0) {
      const screenshot = await this.screenshotProvider();
      if (screenshot) {
        const last = messages[messages.length - 1];
        const text = typeof last.content === 'string' ? last.content : JSON.stringify(last.content);
        last.content = [
          { type: 'text', text },
          { type: 'image_url', image_url: { url: screenshot.startsWith('data:image/') ? screenshot : `data:image/png;base64,${screenshot}` } }
        ];
      }
    }
    const body = {
      model: this.modelName,
      messages,
      temperature: options.temperature ?? 0,
      top_p: options.top_p ?? 1,
      max_completion_tokens: options.maxOutputTokens ?? 768,
      response_format: options.response_model ? { type: 'json_object' } : undefined
    };
    let response;
    let payload;
    try {
      response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify(body)
      });
      payload = await response.json();
      if (!response.ok) throw new Error(`Qwen request failed (${response.status}): ${payload?.error?.message || 'unknown error'}`);
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || !content.trim()) throw new Error('Qwen response contained no text content');
      this.responseObserver?.({
        provider: 'aliyun-compatible', model: this.modelName,
        http_status: response.status, ok: true,
        finish_reason: payload?.choices?.[0]?.finish_reason ?? null,
        has_text_content: true, has_tool_call: Boolean(payload?.choices?.[0]?.message?.tool_calls?.length),
        content_length: content.length,
        content_digest: createHash('sha256').update(content).digest('hex')
      });
      let data = content.trim();
      if (options.response_model) {
        data = JSON.parse(data.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
        if (data && typeof data === 'object') {
          if (typeof data.elementId === 'string') data.elementId = data.elementId.replace(/^\[|\]$/g, '');
          if (!Array.isArray(data.arguments)) data.arguments = [];
          if (typeof data.twoStep !== 'boolean') data.twoStep = false;
        }
      }
      logger?.({ category: 'openai', message: 'qwen stagehand completion accepted', level: 1 });
      return {
        data,
        usage: {
          prompt_tokens: payload?.usage?.prompt_tokens ?? 0,
          completion_tokens: payload?.usage?.completion_tokens ?? 0,
          total_tokens: payload?.usage?.total_tokens ?? 0
        }
      };
    } catch (error) {
      this.responseObserver?.({ provider: 'aliyun-compatible', model: this.modelName, ok: false, error });
      if (retries > 0) return this.createChatCompletion({ options, retries: retries - 1, logger });
      throw error;
    }
  }
}
