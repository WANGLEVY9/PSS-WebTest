# Indico search-events condition pilot

**Evidence boundary:** T1 workflow-condition pilot only.
**Authorization:** This workflow is not admitted and does not authorize power freeze or confirmatory collection.

## Complete condition matrix

Six complete one-repetition blocks were collected: two provider/model strata × three conditions. Every block has exactly three arms and passed the repetition-aware ledger validator.

| Provider/model | Condition | Pure visual | Hybrid | Playwright |
|---|---|---:|---:|---:|
| Qwen3.7-Flash | clean-stable | 0/1 (step-budget) | 1/1 | 1/1 |
| Qwen3.7-Flash | functional fault | 0/1 (oracle failure after fault verdict) | 1/1 | 1/1 |
| Qwen3.7-Flash | UI evolution | 0/1 (step-budget) | 1/1 | 1/1 |
| DeepSeek V4-Flash-Vision-Exp | clean-stable | 0/1 (grounding-loop) | 1/1 | 1/1 |
| DeepSeek V4-Flash-Vision-Exp | functional fault | 0/1 (grounding-loop) | 0/1 (oracle-only success; wall timeout) | 1/1 |
| DeepSeek V4-Flash-Vision-Exp | UI evolution | 0/1 (grounding-loop) | 1/1 | 1/1 |

The strict observed total is Playwright 6/6, Hybrid 5/6, and Pure visual 0/6. These are descriptive one-repetition observations for one workflow, not population estimates. The DeepSeek functional-fault Hybrid run reached the independent fault oracle but did not complete the declared protocol before the wall boundary, so it is explicitly retained as `oracle_only_success` rather than counted as a pass.

## Engineering boundary

The first search pilot failed because the runner did not map provider `return` keypresses to Playwright `Enter`; that defect was repaired before this matrix. Functional fault is a browser-scoped omission of the known result `Test Infrastructure Cost Optimization Meeting`; UI evolution is a presentation-only layout mutation. The create-event database trigger is not reused for this search workflow. All six blocks report `mutation_removed=true` or a clean no-op, and independent search oracles are separate from agent verdicts.

## Gate status

The workflow now has a complete condition/provider pilot, but Indico remains non-admitted because the application-level gate requires eight workflow slots, repeated variance evidence, and all condition lanes for every slot. The next step is to bind and implement additional Indico workflows (form persistence, authorization, delayed save, related entity, and repair-after-evolution) before any application-level admission decision.

## Artifacts

- `artifacts/phase2/indico-three-arm-aliyun-qwen3.7-flash-phase2-indico-search-qwen-fixed-20260913-records.jsonl`
- `artifacts/phase2/indico-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-indico-search-deepseek-fixed-20260913-records.jsonl`
- `artifacts/phase2/indico-three-arm-aliyun-qwen3.7-flash-phase2-indico-search-qwen-fault-20260913-records.jsonl`
- `artifacts/phase2/indico-three-arm-aliyun-qwen3.7-flash-phase2-indico-search-qwen-evolution-20260913-records.jsonl`
- `artifacts/phase2/indico-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-indico-search-deepseek-fault-20260913-records.jsonl`
- `artifacts/phase2/indico-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-indico-search-deepseek-evolution-20260913-records.jsonl`
- `results/phase2/2026-09-13-indico-search-condition-metrics-summary.json`
