# Juice Shop delayed basket feedback pilot (2026-09-13)

Status: diagnostic pilot only; no application admission, variance freeze, or
confirmatory inference.

## Design

This workflow tests a different state boundary from the existing basket task:
the agent must add **Apple Juice (1000ml)** and wait for the delayed visible
confirmation `Placed Apple Juice (1000ml) into basket.`. The delay is a
browser-scoped 1,200 ms feedback hold; it does not alter the basket state,
database, or target product. The functional-fault mutation omits the product,
so the correct fault behavior is to stop without a target or confirmation.
UI evolution changes layout while preserving both the action and oracle.

The independent evaluator checks the target and exact snackbar text. It never
uses the agent verdict or action trace as ground truth. Strict success requires
protocol completion, matching verdict, and oracle success. `oracle_only_success`
is retained as a false strict result.

## Matched pilot results

| Provider/model | Condition | Pure visual | Hybrid | Playwright | Strict block |
|---|---|---:|---:|---:|---:|
| Alibaba / Qwen3.7-Flash | clean-stable | 0/1 (agent-step-budget) | 1/1 | 1/1 | 2/3 |
| Alibaba / Qwen3.7-Flash | functional-fault | 0/1 (oracle-only) | 0/1 (oracle-only) | 1/1 | 1/3 |
| Alibaba / Qwen3.7-Flash | ui-evolution | 0/1 (agent-step-budget) | 0/1 (oracle failure) | 1/1 | 1/3 |
| DeepSeek / V4.1-Flash | clean-stable | 1/1 | 1/1 | 1/1 | 3/3 |
| DeepSeek / V4.1-Flash | functional-fault | 0/1 (oracle-only) | 0/1 (oracle-only) | 1/1 | 1/3 |
| DeepSeek / V4.1-Flash | ui-evolution | 1/1 | 1/1 | 1/1 | 3/3 |

Across 18 valid reset-verified executions:

- Playwright: 6/6 strict;
- Hybrid: 3/6 strict;
- Pure visual: 2/6 strict;
- model-stratified agent-only strict totals: Qwen 1/6, DeepSeek 4/6.

The controller field `passed_cells` is intentionally not used for this table:
it counts independent oracle reachability and therefore includes the four
fault-condition `oracle_only_success` records. Strict values are recomputed
from each record's `cell_passed` field.

## Interpretation boundary

The clean/evolution DeepSeek successes show that the delayed-feedback task is
executable by both agent arms under one model stratum. The repeated fault
oracle-only pattern across Qwen and DeepSeek shows a termination/verdict
problem: both agents recognized the independent fault state but did not emit
the required `fault` verdict before the step budget. This is not an oracle or
SUT-reset failure, but it should not be converted into a capability-wide claim
until repetitions and model/framework strata are expanded.

The Qwen evolution Hybrid result emitted a clean verdict without reaching the
confirmation oracle, so it is retained as an oracle-boundary failure. No
best-of-N or fallback-assisted result is promoted.

## Reproducibility artifacts

Tracked implementation:

- `code/src/mutations/juice-shop.mjs`
- `code/src/oracles/juice-shop-basket-feedback.mjs`
- `code/scripts/evaluate-juice-shop-basket-feedback.mjs`
- `code/tests/traditional/juice-shop-basket-feedback.spec.js`
- `code/config/juice-shop-basket-feedback-run-manifest.v0.1.json`
- `code/scripts/juice-shop-matched-pilot.mjs`

Raw replay and JSONL files remain local under `artifacts/phase2/` and are
ignored. The six controller summaries are named with the `basket-feedback`
provider/model/condition tags. The three-condition Playwright gate passed
before agent execution; final contract validation for this tranche is tracked
with the code commit.
