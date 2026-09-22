# Juice Shop pagination fault/evolution backfill

Date: 2026-09-13
Status: **pilot/diagnostic only; not confirmatory**

This backfill closes the two previously missing condition cells for the
`juice-shop-pagination` workflow: browser-scoped target omission under
`functional-fault` and behavior-preserving layout mutation under
`ui-evolution`. It uses one reset-isolated repetition per condition for Qwen
3.7 Flash and DeepSeek V4.1 Flash, with the same Playwright, pure-visual, and
Hybrid arms.

| Provider/model | Condition | Pure visual | Hybrid | Playwright |
|---|---:|---:|---:|---:|
| Qwen 3.7 Flash | UI evolution | 0/1 (`provider-format`) | 0/1 (`grounding-loop`) | 1/1 |
| Qwen 3.7 Flash | Functional fault | 0/1 (`agent-step-budget`) | 0/1 (`grounding-loop`) | 1/1 |
| DeepSeek V4.1 Flash | UI evolution | 0/1 (`grounding-loop`) | 0/1 (`grounding-loop`) | 1/1 |
| DeepSeek V4.1 Flash | Functional fault | 0/1 (`grounding-loop`) | 0/1 (`grounding-loop`) | 1/1 |

All twelve records have reset verification and complete three-arm cell
membership. The independent pagination oracle is not used as an agent input.
The backfill therefore removes a coverage gap but does not turn the workflow
into an admitted application or support a cross-workflow ranking claim.

Artifacts:

- [condition metrics summary](/Users/laurantwang/PSS-WebTest/results/phase2/2026-09-13-juice-shop-pagination-condition-metrics-summary.json)
- [Juice Shop admission audit](/Users/laurantwang/PSS-WebTest/results/phase2/2026-09-13-juice-shop-admission-audit.json)

After this backfill, the machine audit reports 329 parseable Juice Shop
records, zero missing task×condition×arm cells, and 33 cells below the
three-repetition variance threshold. Confirmatory collection remains frozen.
