# PrestaShop optimized-profile diagnostic batch (2026-09-10)

This batch evaluates the repaired runner/profile plumbing. It remains pilot/diagnostic evidence, not a confirmatory comparison.

## Optimized profile repetitions

| Arm | Runs | Passed | Failed | Notes |
|---|---:|---:|---:|---|
| Pure visual, `aliyun-qwen-grounded-v1`, tool mode | 5 (`r4`--`r8`) | 2 | 3 | Successful runs completed in 3 actions; failures were grounding/step-budget paths |
| Hybrid semantic, `aliyun-qwen-grounded-v1` | 3 (`r7`--`r9`) | 3 | 0 | All selected semantic target `c9`, typed `Mug`, and pressed Enter |

The runner repair made the profile effective: optimized Hybrid runs used a 12-step budget and semantic target-id mode. Pure visual remains variable even after the repair; one run entered a different category route and two runs completed cleanly.

## Current aggregate ledger

The latest three-file audit contains 24 unique run IDs and no duplicates:

| Arm | Records | Completed | Failed |
|---|---:|---:|---:|
| Visual | 8 | 2 | 6 |
| Hybrid | 9 | 8 | 1 |
| Playwright | 7 | 6 | 1 |

The ledger is structurally complete for the clean diagnostic cell, but the denominators are intentionally unequal and mix baseline/optimized protocol strata. No matched-cell success rate, repetition freeze, or confirmatory conclusion is claimed.
