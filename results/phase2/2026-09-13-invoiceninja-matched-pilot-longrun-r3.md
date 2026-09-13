# Invoice Ninja matched pilot round — 2026-09-13

Evidence boundary: diagnostic pilot only; no application admission, repetition freeze, power decision, or confirmatory claim.

Design: repetition labels 1–3 × 3 conditions × 6 arm/model strata; each block was independently reset before the deterministic randomized arm order.

| Condition | Arm/model | n | Strict pass | State reached | Oracle pass | First boundaries |
|---|---|---:|---:|---:|---:|---|
| clean-stable | playwright | 3 | 3/3 | 3/3 | 3/3 | none |
| clean-stable | visual-qwen | 3 | 1/3 | 1/3 | 3/3 | `provider-format` |
| clean-stable | hybrid-qwen | 3 | 3/3 | 3/3 | 3/3 | none |
| clean-stable | visual-deepseek | 3 | 3/3 | 3/3 | 3/3 | none |
| clean-stable | hybrid-deepseek | 3 | 3/3 | 3/3 | 3/3 | none |
| clean-stable | hybrid-doubao | 3 | 0/3 | 0/3 | 3/3 | `provider-api` |
| functional-fault | playwright | 3 | 3/3 | 3/3 | 3/3 | none |
| functional-fault | visual-qwen | 3 | 0/3 | 0/3 | 3/3 | `provider-format`, `grounding-loop` |
| functional-fault | hybrid-qwen | 3 | 3/3 | 3/3 | 3/3 | none |
| functional-fault | visual-deepseek | 3 | 3/3 | 3/3 | 3/3 | none |
| functional-fault | hybrid-deepseek | 3 | 3/3 | 3/3 | 3/3 | none |
| functional-fault | hybrid-doubao | 3 | 0/3 | 0/3 | 3/3 | `provider-api` |
| ui-evolution | playwright | 3 | 3/3 | 3/3 | 3/3 | none |
| ui-evolution | visual-qwen | 3 | 2/3 | 2/3 | 3/3 | `provider-format` |
| ui-evolution | hybrid-qwen | 3 | 3/3 | 3/3 | 3/3 | none |
| ui-evolution | visual-deepseek | 3 | 3/3 | 3/3 | 3/3 | none |
| ui-evolution | hybrid-deepseek | 3 | 3/3 | 3/3 | 3/3 | none |
| ui-evolution | hybrid-doubao | 3 | 0/3 | 0/3 | 3/3 | `provider-api` |

## Run-level audit notes

- A missing or malformed run record remains `no-record` and is not converted into a success.
- Provider/model strata are reported separately; no model pooling is performed.
- The aggregate ledger is `code/artifacts/phase2/invoiceninja-matched-longrun-r3-aggregate.jsonl`; audit it as one matched file before analysis.
- Raw screenshots, provider summaries, and JSONL records remain local under ignored `code/artifacts/phase2/`.

## Cross-stratum interpretation

The normalized audit is stored in
`results/phase2/2026-09-13-invoiceninja-matched-pilot-longrun-r3-metrics-summary.json`.
All 54 independent-oracle calls returned the seeded invoice state, including
the provider-blocked rows; therefore oracle success is explicitly not treated
as execution success. Qwen Hybrid, DeepSeek Pure visual, DeepSeek Hybrid, and
Playwright completed all nine matched cells in this batch. Qwen Pure visual
completed three of nine, with four provider-format and two grounding-loop
boundaries. Doubao Hybrid completed zero of nine because every call was
classified as `provider-api`, so those rows are not capability evidence.

This batch is useful for variance and failure-taxonomy planning only. It does
not close Invoice Ninja admission: the application remains license/ops
review-gated, the image digest is not frozen in the public manifest, and the
model/protocol strata are intentionally not pooled.
