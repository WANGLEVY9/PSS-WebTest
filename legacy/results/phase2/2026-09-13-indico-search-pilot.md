# Indico search-events workflow pilot

**Evidence boundary:** T1 workflow-pilot evidence only.
**Authorization:** This workflow is not admitted and does not authorize power freeze or confirmatory collection.

## Runner repair

The first Qwen search attempt exposed an engineering incompatibility rather than a model capability result: the provider emitted a `keypress` action with key `return`, while the Indico agent runner only translated `ENTER`. Playwright therefore rejected the action before navigation. The runner now maps both `RETURN` and `ENTER` to Playwright `Enter`. The pre-fix Qwen run is retained as a diagnostic artifact and excluded from this post-fix summary.

## Post-fix matched clean pilot

| Provider/model | Pure visual | Hybrid | Playwright |
|---|---:|---:|---:|
| Qwen3.7-Flash | 0/1 (agent-step-budget; route not reached) | 1/1 | 1/1 |
| DeepSeek V4-Flash-Vision-Exp | 0/1 (grounding-loop) | 1/1 | 1/1 |

The independent visible-search oracle required the exact `/search/?q=test` route, a Search heading, at least one event result, and every visible result title containing `test`. Hybrid completed in three actions for both providers; Playwright completed in five scripted actions. Pure visual now reaches the keypress boundary without an execution exception, but neither provider reached the search route under the current budget, so these failures are classified as model/grounding pilot evidence rather than runner incompatibility.

This is one clean repetition per provider for one workflow. Functional-fault and UI-evolution mutations are not yet defined for this search task; therefore this workflow cannot contribute to an application-level three-condition admission gate.

## Artifacts

- `artifacts/phase2/indico-three-arm-aliyun-qwen3.7-flash-phase2-indico-search-qwen-fixed-20260913-records.jsonl`
- `artifacts/phase2/indico-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-indico-search-deepseek-fixed-20260913-records.jsonl`
- `results/phase2/2026-09-13-indico-search-pilot-metrics-summary.json`
- `code/scripts/run-indico-agent-pilot.mjs`
- `code/scripts/indico-matched-pilot.mjs`
