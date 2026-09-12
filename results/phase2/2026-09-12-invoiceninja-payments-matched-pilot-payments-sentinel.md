# Invoice Ninja recent-payments matched pilot — 2026-09-12

Evidence boundary: T1 diagnostic pilot only; no admission, repetition freeze, power, or confirmatory claim.

Design: 1 repetition(s) × 3 conditions × 6 arm/model strata; each block reset the SUT before a deterministic pseudo-random arm order.

| Condition | Arm/model | n | Strict pass | State reached | Oracle pass | Failure boundaries |
|---|---|---:|---:|---:|---:|---|
| clean-stable | playwright | 1 | 1/1 | 1/1 | 1/1 | none |
| clean-stable | visual-qwen | 1 | 1/1 | 1/1 | 1/1 | none |
| clean-stable | hybrid-qwen | 1 | 1/1 | 1/1 | 1/1 | none |
| clean-stable | visual-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |
| clean-stable | hybrid-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |
| clean-stable | hybrid-doubao | 1 | 0/1 | 0/1 | 1/1 | `provider-api` |
| functional-fault | playwright | 1 | 1/1 | 1/1 | 1/1 | none |
| functional-fault | visual-qwen | 1 | 0/1 | 0/1 | 1/1 | `grounding-loop` |
| functional-fault | hybrid-qwen | 1 | 0/1 | 1/1 | 1/1 | `provider-format` |
| functional-fault | visual-deepseek | 1 | 0/1 | 0/1 | 1/1 | `agent-step-budget` |
| functional-fault | hybrid-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |
| functional-fault | hybrid-doubao | 1 | 0/1 | 0/1 | 1/1 | `provider-api` |
| ui-evolution | playwright | 1 | 1/1 | 1/1 | 1/1 | none |
| ui-evolution | visual-qwen | 1 | 1/1 | 1/1 | 1/1 | none |
| ui-evolution | hybrid-qwen | 1 | 1/1 | 1/1 | 1/1 | none |
| ui-evolution | visual-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |
| ui-evolution | hybrid-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |
| ui-evolution | hybrid-doubao | 1 | 0/1 | 0/1 | 1/1 | `provider-api` |

Raw screenshots/replays and JSONL stay under ignored code/artifacts/phase2. Missing records remain failures and are never imputed.

