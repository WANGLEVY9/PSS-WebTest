# Alibaba Qwen3-VL Provider Connectivity Evidence (2026-08-23)

## Scope

This check validates that the configured Alibaba Model Studio endpoint accepts real BookStack observations for both provider-facing arms. It is a connectivity and input-contract check only. It is not a matched pilot, does not execute an agent action, and does not establish task reliability.

## Configuration

- Provider: `aliyun`
- Model: `qwen3-vl-flash`
- Endpoint family: Alibaba OpenAI-compatible `/chat/completions` endpoint in China (Beijing)
- SUT: local BookStack at `http://127.0.0.1:8081`
- SUT state: unauthenticated login page (`/login`)
- Image input: real local BookStack screenshot, JPEG quality 60
- Hybrid input: the same screenshot plus Playwright accessibility snapshot
- Credentials: not used or transmitted
- Screenshot/observation files: not persisted by the smoke runner

## Results

Command: `npm run provider:bookstack:connectivity`

| Arm | Provider response | Latency | Retries | Parsed decision | Action executed |
|---|---:|---:|---:|---|---|
| Pure visual | HTTP success | 1221 ms | 0 | `action/click` with pixel coordinates | No |
| Hybrid | HTTP success | 867 ms | 0 | `action/click` with pixel coordinates | No |

Both decisions were parsed by the project driver, and both were converted from normalized coordinates to the 1280×720 pixel viewport. No provider failure, timeout, retry, malformed JSON, or contract violation occurred in this check.

## Boundary

This evidence establishes that `qwen3-vl-flash` can receive the two observation formats and return a parseable action on the current machine. It does **not** show that the model can reliably complete the multi-step BookStack task. BookStack credentials are still required before a real authenticated task run. The matched-pilot admission gate, repetition freeze, power simulation, and confirmatory collection remain frozen.
