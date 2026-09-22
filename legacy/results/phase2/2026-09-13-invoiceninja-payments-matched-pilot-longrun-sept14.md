# Invoice Ninja recent-payments matched pilot — 2026-09-13

Evidence boundary: T1 diagnostic pilot only; no admission, repetition freeze, power, or confirmatory claim.

Design: 3 repetition(s) × 3 conditions × 6 arm/model strata; each block reset the SUT before a deterministic pseudo-random arm order.

| Condition | Arm/model | n | Strict pass | State reached | Oracle pass | Failure boundaries |
|---|---|---:|---:|---:|---:|---|
| clean-stable | playwright | 3 | 3/3 | 3/3 | 3/3 | none |
| clean-stable | visual-qwen | 3 | 3/3 | 3/3 | 3/3 | none |
| clean-stable | hybrid-qwen | 3 | 3/3 | 3/3 | 3/3 | none |
| clean-stable | visual-deepseek | 3 | 3/3 | 3/3 | 3/3 | none |
| clean-stable | hybrid-deepseek | 3 | 3/3 | 3/3 | 3/3 | none |
| clean-stable | hybrid-doubao | 3 | 0/3 | 0/3 | 3/3 | `provider-api` |
| functional-fault | playwright | 3 | 3/3 | 3/3 | 3/3 | none |
| functional-fault | visual-qwen | 3 | 2/3 | 2/3 | 3/3 | `oracle` |
| functional-fault | hybrid-qwen | 3 | 3/3 | 3/3 | 3/3 | none |
| functional-fault | visual-deepseek | 3 | 3/3 | 3/3 | 3/3 | none |
| functional-fault | hybrid-deepseek | 3 | 3/3 | 3/3 | 3/3 | none |
| functional-fault | hybrid-doubao | 3 | 0/3 | 0/3 | 3/3 | `provider-api` |
| ui-evolution | playwright | 3 | 3/3 | 3/3 | 3/3 | none |
| ui-evolution | visual-qwen | 3 | 3/3 | 3/3 | 3/3 | none |
| ui-evolution | hybrid-qwen | 3 | 3/3 | 3/3 | 3/3 | none |
| ui-evolution | visual-deepseek | 3 | 3/3 | 3/3 | 3/3 | none |
| ui-evolution | hybrid-deepseek | 3 | 3/3 | 3/3 | 3/3 | none |
| ui-evolution | hybrid-doubao | 3 | 0/3 | 0/3 | 3/3 | `provider-api` |

Aggregate ledger: `code/artifacts/phase2/invoiceninja-payments-matched-longrun-sept14-aggregate.jsonl`. Raw screenshots/replays stay under ignored code/artifacts/phase2. Missing records remain failures and are never imputed.

