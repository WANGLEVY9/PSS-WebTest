# Invoice Ninja matched pilot round — 2026-09-12

Evidence boundary: diagnostic pilot only; no application admission, repetition freeze, power decision, or confirmatory claim.

Design: repetition labels 3–3 × 3 conditions × 6 arm/model strata; each block was independently reset before the deterministic randomized arm order.

| Condition | Arm/model | n | Strict pass | State reached | Oracle pass | First boundaries |
|---|---|---:|---:|---:|---:|---|
| clean-stable | playwright | 1 | 1/1 | 1/1 | 1/1 | none |
| clean-stable | visual-qwen | 1 | 0/1 | 0/1 | 1/1 | `provider-format` |
| clean-stable | hybrid-qwen | 1 | 1/1 | 1/1 | 1/1 | none |
| clean-stable | visual-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |
| clean-stable | hybrid-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |
| clean-stable | hybrid-doubao | 1 | 0/1 | 0/1 | 1/1 | `provider-api` |
| functional-fault | playwright | 1 | 1/1 | 1/1 | 1/1 | none |
| functional-fault | visual-qwen | 1 | 0/1 | 0/1 | 1/1 | `provider-format` |
| functional-fault | hybrid-qwen | 1 | 1/1 | 1/1 | 1/1 | none |
| functional-fault | visual-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |
| functional-fault | hybrid-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |
| functional-fault | hybrid-doubao | 1 | 0/1 | 0/1 | 1/1 | `provider-api` |
| ui-evolution | playwright | 1 | 1/1 | 1/1 | 1/1 | none |
| ui-evolution | visual-qwen | 1 | 0/1 | 0/1 | 1/1 | `provider-format` |
| ui-evolution | hybrid-qwen | 1 | 1/1 | 1/1 | 1/1 | none |
| ui-evolution | visual-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |
| ui-evolution | hybrid-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |
| ui-evolution | hybrid-doubao | 1 | 0/1 | 0/1 | 1/1 | `provider-api` |

## Run-level audit notes

- A missing or malformed run record remains `no-record` and is not converted into a success.
- Provider/model strata are reported separately; no model pooling is performed.
- Raw screenshots, provider summaries, and JSONL records remain local under ignored `code/artifacts/phase2/`.
