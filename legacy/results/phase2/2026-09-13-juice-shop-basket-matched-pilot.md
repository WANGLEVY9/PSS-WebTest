# Juice Shop add-to-basket matched pilot (2026-09-13)

Status: **pilot / diagnostic only**. This block is not confirmatory evidence and does not freeze repetitions or power.

## Scope

- Application: OWASP Juice Shop 20.0.0; every execution passed the reset and clean-state gate with reset digest `7e7ed8011d2495044de6518d9f84a200aa44ec762693a21fcde6465d1f8a98ab`.
- Workflow: `juice-shop-add-to-basket`: add Apple Juice (1000ml), open the shopping cart, and verify the item/quantity/price state.
- Arms: screenshot-only pure visual, screenshot plus allow-listed page structure hybrid, accessibility-locator Playwright.
- Providers: Alibaba `qwen3.7-flash` and DeepSeek `deepseek-v4-flash-vision-exp`.
- Conditions: clean-stable, browser-scoped product omission fault, behavior-preserving UI evolution.
- One repetition per provider × condition; all blocks were reset and randomized before arm execution.

## Strict outcomes

| Provider/model | Condition | Pure visual | Hybrid | Playwright |
|---|---|---:|---:|---:|
| Alibaba/qwen3.7-flash | clean-stable | 0/1 | 1/1 | 1/1 |
| Alibaba/qwen3.7-flash | functional-fault | 0/1 | 0/1 | 1/1 |
| Alibaba/qwen3.7-flash | UI evolution | 0/1 | 1/1 | 1/1 |
| DeepSeek/deepseek-v4-flash-vision-exp | clean-stable | 0/1 | 1/1 | 1/1 |
| DeepSeek/deepseek-v4-flash-vision-exp | functional-fault | 0/1 | 0/1 | 1/1 |
| DeepSeek/deepseek-v4-flash-vision-exp | UI evolution | 1/1 | 1/1 | 1/1 |

Overall: pure visual 1/6, hybrid 4/6, Playwright 6/6. All six blocks are complete three-arm randomization blocks; ledger audit reports 18 records, 18 unique run IDs, and no missing-arm errors.

## Failure boundaries

- Qwen visual clean/evolution reached or remained on the catalog but exhausted the 20-step cross-page-state budget without a correct basket oracle; Qwen fault reached the independent omission oracle but did not emit `fault`.
- Qwen hybrid clean/evolution passed after the profile's semantic target-id mode was correctly forwarded to the driver; its fault run reached the omission oracle but did not emit `fault`.
- DeepSeek visual clean reached a wrong basket state (oracle failure), fault reached the omission oracle but did not terminate, and UI-evolution passed.
- DeepSeek hybrid clean/evolution passed; fault reached the omission oracle but ended at an execution boundary without a strict fault completion.
- Playwright passed all six cells.

These are capability/protocol boundaries after reset and oracle gates, not SUT infrastructure failures. The functional-fault cases deliberately distinguish recognizing a missing target from completing the required fault verdict.

## Engineering changes validated

1. Added a state-propagation workflow, independent basket oracle, product-omission mutation, and task-specific Playwright spec.
2. Passed the task family `cross-page-state` to agent optimization, raising the declared agent budget to 20 steps and 30 seconds.
3. Fixed the hybrid runner to pass the resolved semantic action mode into the driver; without this, profile-declared target IDs were silently interpreted as coordinate actions.
4. Added product-context names to hybrid pageStructure candidates (`Add to Basket: Apple Juice (1000ml)`) so target selection is not ambiguous.
5. Kept fault detection at the catalog omission boundary: a correct fault can be reported before navigating to a basket that cannot contain the missing item.

Raw screenshots/replays and JSONL records remain local under ignored `artifacts/phase2/`; this report contains no credentials or raw provider content.
