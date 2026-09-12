# Invoice Ninja matched pilot round — 2026-09-12

Evidence boundary: diagnostic pilot only; no application admission, repetition freeze, power decision, or confirmatory claim.

Design: repetition labels 2–2 × 3 conditions × 5 arm/model strata; each block was independently reset before the deterministic randomized arm order.

Ledger audit: 15 unique records, 13 strict passes. Playwright, Qwen Hybrid,
DeepSeek visual, and DeepSeek Hybrid passed in all three conditions; Qwen Pure
visual passed only the clean condition and failed both mutated conditions at
the `provider-format` boundary.

| Condition | Arm/model | n | Strict pass | State reached | Oracle pass | First boundaries |
|---|---|---:|---:|---:|---:|---|
| clean-stable | playwright | 1 | 1/1 | 1/1 | 1/1 | none |
| clean-stable | visual-qwen | 1 | 1/1 | 1/1 | 1/1 | none |
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
- The persisted JSONL ledger and independent audit are authoritative; the
  controller's top-level Playwright stdout mapping has been fixed for future
  rounds.
- Provider/model strata are reported separately; no model pooling is performed.
- Raw screenshots, provider summaries, and JSONL records remain local under ignored `code/artifacts/phase2/`.
