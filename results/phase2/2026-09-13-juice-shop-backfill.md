# Juice Shop repetition-complete backfill

**Evidence boundary:** T1 pilot / variance diagnostics only.
**Authorization:** This backfill does not admit Juice Shop or authorize confirmatory collection.

The previous sequential condition batch exposed two repetition-level ledger gaps. Rather than editing those historical files, this backfill ran two fresh, complete matched blocks with new run tags and independent resets:

| Provider/model | Condition | Repetitions | Records | Strict passes |
|---|---|---:|---:|---:|
| Qwen3.7-Flash | UI evolution | 2 | 6/6 | 2/6 |
| DeepSeek V4-Flash-Vision-Exp | functional fault | 2 | 6/6 | 4/6 |

The repetition-aware validator reports `status=ok`, `randomization_blocks=4`, and `complete_blocks=4`. For Qwen UI evolution, both Playwright repetitions passed while Hybrid emitted a clean verdict that the independent oracle rejected and Pure visual reached grounding-loop failures. For DeepSeek functional fault, both Playwright and both Hybrid repetitions passed the independent fault oracle; Pure visual failed once at the step budget and once at grounding-loop.

These observations are useful for variance planning, but the sample is still only two repetitions in two condition/provider strata and covers one workflow. It does not establish an application admission gate or a strategy ranking. The original 46-record batch and its two incomplete blocks remain preserved and separately reported.

## Artifacts

- `artifacts/phase2/juice-shop-three-arm-aliyun-qwen3.7-flash-phase2-backfill-juice-qwen-evolution-20260913-records.jsonl`
- `artifacts/phase2/juice-shop-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-backfill-juice-deepseek-fault-20260913-records.jsonl`
- `results/phase2/2026-09-13-juice-shop-backfill-metrics-summary.json`
- `code/scripts/validate-condition-batch.mjs`
