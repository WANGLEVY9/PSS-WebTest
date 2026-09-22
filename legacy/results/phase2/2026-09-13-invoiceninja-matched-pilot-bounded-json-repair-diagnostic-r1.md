# Invoice Ninja matched pilot round — 2026-09-13

Evidence boundary: diagnostic pilot only; no application admission, repetition freeze, power decision, or confirmatory claim.

Design: repetition labels 1–1 × 1 conditions × 3 arm/model strata; each block was independently reset before the deterministic randomized arm order.

| Condition | Arm/model | n | Strict pass | State reached | Oracle pass | First boundaries |
|---|---|---:|---:|---:|---:|---|
| clean-stable | playwright | 1 | 1/1 | 1/1 | 1/1 | none |
| clean-stable | visual-qwen | 1 | 1/1 | 1/1 | 1/1 | none |
| clean-stable | hybrid-qwen | 1 | 1/1 | 1/1 | 1/1 | none |

## Run-level audit notes

- A missing or malformed run record remains `no-record` and is not converted into a success.
- Provider/model strata are reported separately; no model pooling is performed.
- The aggregate ledger is `code/artifacts/phase2/invoiceninja-matched-bounded-json-repair-diagnostic-r1-aggregate.jsonl`; audit it as one matched file before analysis.
- Raw screenshots, provider summaries, and JSONL records remain local under ignored `code/artifacts/phase2/`.

