# Invoice Ninja matched pilot round — 2026-09-12

Evidence boundary: diagnostic pilot only; no application admission, repetition freeze, power decision, or confirmatory claim.

Design: 1 repetition(s) × 3 conditions × 5 arm/model strata; each block was independently reset before the deterministic randomized arm order.

Ledger audit: 15 unique records, 12 strict passes; all three Playwright
records, all six DeepSeek agent records, and all three Qwen Hybrid records
passed. Qwen Pure-visual failed at `provider-format` in all three conditions.

| Condition | Arm/model | n | Strict pass | State reached | Oracle pass | First boundaries |
|---|---|---:|---:|---:|---:|---|
| clean-stable | playwright | 1 | 1/1 | 1/1 | 1/1 | none |
| clean-stable | visual-qwen | 1 | 0/1 | 0/1 | 1/1 | `provider-format` |
| clean-stable | hybrid-qwen | 1 | 1/1 | 1/1 | 1/1 | none |
| clean-stable | visual-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |
| clean-stable | hybrid-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |
| functional-fault | playwright | 1 | 1/1 | 1/1 | 1/1 | none |
| functional-fault | visual-qwen | 1 | 0/1 | 0/1 | 1/1 | `provider-format` |
| functional-fault | hybrid-qwen | 1 | 1/1 | 1/1 | 1/1 | none |
| functional-fault | visual-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |
| functional-fault | hybrid-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |
| ui-evolution | playwright | 1 | 1/1 | 1/1 | 1/1 | none |
| ui-evolution | visual-qwen | 1 | 0/1 | 0/1 | 1/1 | `provider-format` |
| ui-evolution | hybrid-qwen | 1 | 1/1 | 1/1 | 1/1 | none |
| ui-evolution | visual-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |
| ui-evolution | hybrid-deepseek | 1 | 1/1 | 1/1 | 1/1 | none |

## Run-level audit notes

- A missing or malformed run record remains `no-record` and is not converted into a success.
- The first controller rendering briefly treated Playwright's top-level stdout
  summary as `no-record`; the persisted JSONL record and independent ledger
  audit are authoritative, and the rendering parser has now been fixed.
- Provider/model strata are reported separately; no model pooling is performed.
- Raw screenshots, provider summaries, and JSONL records remain local under ignored `code/artifacts/phase2/`.
