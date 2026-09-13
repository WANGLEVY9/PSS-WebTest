# Juice Shop model-stratified repetition backfill

Date: 2026-09-13
Status: **pilot/diagnostic only; not confirmatory**

## What was run

After closing the task/condition/arm coverage gaps, we ran a model-stratified
repetition tranche rather than pooling Qwen and DeepSeek. The tranche contains
45 matched block ledgers and 135 executions (45 Playwright, 45 pure visual,
45 Hybrid), all with fresh reset verification and the existing independent
oracles:

- Qwen 3.7 Flash: repetition-3 backfill for the 11 previously under-covered
  condition blocks, plus targeted clean pagination-last-item and authorization
  cells;
- DeepSeek V4.1 Flash: the same repetition-3 blocks, targeted product-detail,
  add-to-basket, authorization, pagination and pagination-last-item cells, and
  final second/third repetitions for the remaining strata.

The legacy `qwen3-vl-flash` profile was not silently reinterpreted as Qwen 3.7
Flash. Its two remaining clean-search arm cells stay quarantined as legacy.

## Aggregate tranche accounting

| Stratum | New records | Strict passes | Note |
|---|---:|---:|---|
| Qwen 3.7 Flash | 66 | recorded in ledger | Includes the Qwen R3 and targeted blocks |
| DeepSeek V4.1 Flash | 69 | recorded in ledger | Includes DeepSeek R3, targeted and final blocks |
| Total | 135 |  | No best-of-N selection |

This table is accounting only; the machine-readable summary keeps every
workflow/condition/arm/model cell separate.

## Current audit state

The full Juice Shop ledger now contains **530 parseable records** and **280
strict passes**. All 8 workflows × 3 conditions × 3 arms have coverage, and no
pooled cell is below three records. The provider/model-stratified audit has only
two below-threshold entries, both from the explicitly quarantined legacy
`qwen3-vl-flash` clean-search visual/Hybrid cells. The current Qwen 3.7 Flash
and DeepSeek V4.1 Flash strata therefore have the required three records for
the audited cells in this tranche.

This is still not an application admission or confirmatory result: the audit
retains 18 invalid/legacy records, the strict pass rates are heterogeneous,
and the repetition threshold is a pilot input rather than a frozen power
decision. Confirmatory collection remains disabled.

Artifacts:

- [stratified metrics summary](/Users/laurantwang/PSS-WebTest/results/phase2/2026-09-13-juice-shop-stratified-backfill-metrics-summary.json)
- [fail-closed admission audit](/Users/laurantwang/PSS-WebTest/results/phase2/2026-09-13-juice-shop-admission-audit.json)
- [Qwen repetition report](/Users/laurantwang/PSS-WebTest/results/phase2/2026-09-13-juice-shop-qwen-repetition-backfill.md)
