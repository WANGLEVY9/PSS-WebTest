# DeepSeek V4.1-Flash vision connectivity (2026-09-10)

This is a provider-stratified feasibility result, not confirmatory evidence.

## Configuration

- Provider: `deepseek`
- Official model ID: `deepseek-flash` (the DeepSeek documentation identifies this as the current Flash vision model)
- OpenAI-compatible endpoint: `https://api.deepseek.com/chat/completions`
- Image input: local BookStack screenshot as a `data:image/jpeg` URL in a user message
- Action output: Tool Calls with `ui_action`; thinking explicitly disabled for deterministic action output
- Arms: pure visual (`screenshot-only`) and hybrid (`screenshot-plus-structure`)

## Smoke result

| arm | HTTP/provider outcome | parsed decision | retries | observation contract |
|---|---:|---|---:|---|
| pure visual | success (HTTP 200) | click | 0 | screenshot-only |
| hybrid | success (HTTP 200) | click | 0 | screenshot-plus-structure |

The local SUT was BookStack at `http://127.0.0.1:8081`; credentials were not submitted by this smoke test. Raw request/response data and screenshots remain in ignored local artifacts.

## Engineering note

An initial JSON-output attempt was not promoted: a complex multi-step create-page run returned HTTP 200 but non-JSON content after several actions. The driver now uses Tool Calls by default for DeepSeek and sends `thinking: {"type":"disabled"}`. This is recorded as a provider-specific diagnostic boundary, not silently reclassified as a SUT failure.

References: [DeepSeek image understanding](https://api-docs.deepseek.com/zh-cn/guides/vision/), [DeepSeek thinking mode](https://api-docs.deepseek.com/zh-cn/guides/thinking_mode/), [DeepSeek Tool Calls](https://api-docs.deepseek.com/zh-cn/guides/tool_calls/).
