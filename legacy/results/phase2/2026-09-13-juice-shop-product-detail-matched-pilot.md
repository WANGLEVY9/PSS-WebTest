# Juice Shop product-detail matched pilot (2026-09-13)

Status: **pilot / diagnostic only**. This block is not confirmatory evidence and does not freeze repetitions or power.

## Scope

- Application: OWASP Juice Shop 20.0.0, reset digest `7e7ed8011d2495044de6518d9f84a200aa44ec762693a21fcde6465d1f8a98ab`.
- Workflow: `juice-shop-product-detail`, open the Apple Juice (1000ml) detail dialog and verify the visible title and price.
- Arms: screenshot-only pure visual, screenshot + declared page structure hybrid, accessibility-locator Playwright.
- Providers: Alibaba `qwen3.7-flash` and DeepSeek `deepseek-v4-flash-vision-exp`.
- Conditions: clean-stable, browser-scoped functional fault (omit Apple Juice from the product response), behavior-preserving UI evolution.
- Qwen: three repetitions per condition; DeepSeek: one repetition per condition. Every block was reset and randomized before the three arms.

## Strict outcomes

| Provider/model | Condition | Pure visual | Hybrid | Playwright |
|---|---|---:|---:|---:|
| Alibaba/qwen3.7-flash | clean-stable | 2/3 | 3/3 | 3/3 |
| Alibaba/qwen3.7-flash | functional-fault | 0/3 | 0/3 | 3/3 |
| Alibaba/qwen3.7-flash | UI evolution | 2/3 | 3/3 | 3/3 |
| DeepSeek/deepseek-v4-flash-vision-exp | clean-stable | 1/1 | 1/1 | 1/1 |
| DeepSeek/deepseek-v4-flash-vision-exp | functional-fault | 0/1 | 0/1 | 1/1 |
| DeepSeek/deepseek-v4-flash-vision-exp | UI evolution | 1/1 | 1/1 | 1/1 |

Across the expanded pilot: pure visual 6/12, hybrid 8/12, Playwright 12/12. Four agent-arm fault failures reached the independent omission oracle (`oracle_only_success=true`) but exhausted the step budget without emitting the required `fault` verdict; two additional Qwen clean/evolution visual failures were provider-format boundaries before the oracle. All are strict failures, not infrastructure failures.

## Engineering changes validated

1. Added a browser-scoped product-omission mutation that preserves the response schema.
2. Added an independent product-detail oracle requiring the product-details dialog, exact title, and exact price; the fault oracle requires the target omission.
3. Added a task-specific Playwright spec and run manifest while reusing the same matched reset/randomization/ledger path.
4. Unified overlay dismissal before exposing screenshots/page structure. A prior hybrid failure was reproduced as an overlay intercept and provider-format click with missing coordinates; the fixed clean block passed.
5. Fixed the Playwright evaluator to replay the same visible action before judging the independent oracle.

## Boundary interpretation

The clean/evolution blocks show that both agent arms can complete a simple, visually salient task with both providers. The fault blocks expose a separate capability boundary: recognizing a missing target is not equivalent to terminating with a correct fault verdict within the action budget. This is a pilot diagnosis, not a ranking claim.

Raw screenshots/replays and JSONL records remain local under the ignored `artifacts/phase2/` directory; this report contains no credentials or raw provider content.
