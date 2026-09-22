# Invoice Ninja matched pilot round — 2026-09-13

Evidence boundary: diagnostic pilot only; no application admission, repetition freeze, power decision, or confirmatory claim.

Design: repetition labels 1–3 × 2 conditions × 3 arm/model strata; each block was independently reset before the deterministic randomized arm order.

| Condition | Arm/model | n | Strict pass | State reached | Oracle pass | First boundaries |
|---|---|---:|---:|---:|---:|---|
| functional-fault | playwright | 3 | 3/3 | 3/3 | 3/3 | none |
| functional-fault | visual-qwen | 3 | 0/3 | 0/3 | 3/3 | `provider-format` |
| functional-fault | hybrid-qwen | 3 | 3/3 | 3/3 | 3/3 | none |
| ui-evolution | playwright | 3 | 3/3 | 3/3 | 3/3 | none |
| ui-evolution | visual-qwen | 3 | 1/3 | 1/3 | 3/3 | `grounding-loop`, `provider-format` |
| ui-evolution | hybrid-qwen | 3 | 3/3 | 3/3 | 3/3 | none |

## Run-level audit notes

- A missing or malformed run record remains `no-record` and is not converted into a success.
- Provider/model strata are reported separately; no model pooling is performed.
- The aggregate ledger is `code/artifacts/phase2/invoiceninja-matched-strict-condition-r3-aggregate.jsonl`; audit it as one matched file before analysis.
- Raw screenshots, provider summaries, and JSONL records remain local under ignored `code/artifacts/phase2/`.

