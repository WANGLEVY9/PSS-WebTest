# Juice Shop Qwen repetition backfill

Date: 2026-09-13
Status: **pilot/diagnostic only; not confirmatory**

This batch executes the 11 condition blocks that previously had only two
historical repetitions: `add-to-basket` fault/evolution, all three
`basket-feedback` conditions, all three `basket-quantity` conditions,
`authorization-guard` evolution, and `pagination` fault/evolution. Each block
uses a fresh reset and all three arms under the frozen Qwen 3.7 Flash profile.
It adds 33 append-only records.

| Workflow family | Conditions | Pure visual | Hybrid | Playwright |
|---|---|---:|---:|---:|
| add-to-basket | fault, evolution | 0/2 | 1/2 | 2/2 |
| basket-feedback | clean, fault, evolution | 0/3 | 1/3 | 3/3 |
| basket-quantity | clean, fault, evolution | 0/3 | 1/3 | 3/3 |
| authorization-guard | evolution | 1/1 | 1/1 | 1/1 |
| pagination | fault, evolution | 0/2 | 0/2 | 2/2 |

The table is a bounded diagnostic summary: denominators are the new Qwen
backfill records only, not a pooled model estimate. Agent failures are kept in
the ledger. The dominant boundaries were action-step budget, oracle mismatch,
and grounding-loop; there were no reset or provider-transport exclusions in
this batch.

The global admission audit now reports 362 parseable Juice Shop records, zero
missing task×condition×arm cells, and zero pooled cells below three records.
However, 73 provider/model strata remain below the three-repetition threshold
(and 18 legacy/invalid records remain quarantined), so model-stratified
variance and power inputs are not frozen.

- [admission audit](/Users/laurantwang/PSS-WebTest/results/phase2/2026-09-13-juice-shop-admission-audit.json)
- [basket-quantity metrics](/Users/laurantwang/PSS-WebTest/results/phase2/2026-09-13-juice-shop-basket-quantity-metrics-summary.json)
