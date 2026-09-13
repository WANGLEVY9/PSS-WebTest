# Juice Shop pilot power-planning refresh

Date: 2026-09-13  
Status: **planning-only; no repetition count frozen**

Two small matched pilot inputs were re-run through the stratified cluster
simulation after the cross-application ledger audit. Both inputs contain one
task × condition cell with two repetitions per arm, so between-cell variance is
not estimable; the simulation therefore sweeps its declared sensitivity grid.

| Input stratum | Playwright | Pure visual | Hybrid | Records |
|---|---:|---:|---:|---:|
| DeepSeek, product-search, clean | 2/2 | 0/2 | 2/2 | 6 |
| Qwen 3.7 Flash, product-detail, clean | 2/2 | 1/2 | 2/2 | 6 |

The outputs are descriptive planning inputs only. They do not establish that
Playwright or Hybrid is universally better, because the pilot cells are tiny,
single-application, single-condition slices and the model strata are not
pooled. The complete Juice Shop ledger has broader coverage, but the variance
freeze must use a prespecified cell-level model over all eligible workflows,
conditions, and live provider strata—not these illustrative slices alone.

Machine-readable outputs:

- [`2026-09-13-juice-deepseek-clean-power-planning-v2.json`](2026-09-13-juice-deepseek-clean-power-planning-v2.json)
- [`2026-09-13-juice-qwen-product-detail-clean-power-planning-v2.json`](2026-09-13-juice-qwen-product-detail-clean-power-planning-v2.json)

Next gate: construct the frozen multi-cell pilot input from the stratified
ledger summary, then rerun the preregistered simulation with application ×
workflow heterogeneity and explicit model/framework interaction terms.
