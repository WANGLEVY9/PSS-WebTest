# Invoice Ninja two-workflow pilot synthesis — 2026-09-13

Evidence boundary: diagnostic pilot only. These 108 executions do not admit
Invoice Ninja, freeze repetitions, estimate confirmatory power, or authorize
confirmatory collection. Model/provider strata are kept separate.

## Scope

Two benchmark-derived workflows were run with three independent repetitions
per condition and one reset before each matched condition block:

1. `invoiceninja-view-invoice-details` — authenticated dashboard to invoice
   `123456`, with persisted invoice oracle;
2. `invoiceninja-recent-payments` — authenticated dashboard to payment `0001`,
   with persisted payment oracle.

Each workflow has clean-stable, functional-fault, and behavior-preserving
UI-evolution conditions. The six strata are Playwright, Qwen pure visual and
Hybrid, DeepSeek pure visual and Hybrid, and Doubao Hybrid. Each aggregate
ledger has 54 unique records and an `audit-run-ledger` status of `ok`.

## Summary

| Workflow | Records | Strict passes | Playwright | Qwen visual | Qwen Hybrid | DeepSeek visual | DeepSeek Hybrid | Doubao Hybrid |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| View invoice details | 54 | 39 | 9/9 | 3/9 | 9/9 | 9/9 | 9/9 | 0/9 provider-api |
| Recent payments | 54 | 41 | 9/9 | 6/9 | 9/9 | 8/9 | 9/9 | 0/9 provider-api |

The detailed machine-readable summaries are
[`2026-09-13-invoiceninja-matched-pilot-longrun-r3-metrics-summary.json`](2026-09-13-invoiceninja-matched-pilot-longrun-r3-metrics-summary.json)
and
[`2026-09-13-invoiceninja-payments-matched-pilot-longrun-payments-r3-metrics-summary.json`](2026-09-13-invoiceninja-payments-matched-pilot-longrun-payments-r3-metrics-summary.json).

## Failure-boundary interpretation

- Playwright completed all 18 workflow-condition cells.
- Qwen Hybrid completed all 18 cells in this batch.
- DeepSeek Hybrid completed all 18 cells.
- DeepSeek pure visual completed 17/18; the one failure was an
  `agent-step-budget` boundary on the payment fault condition.
- Qwen pure visual completed 9/18. Its six failures were split across
  `provider-format` and `grounding-loop`; none were reset or oracle failures.
- Doubao Hybrid completed 0/18 because every request was classified
  as `provider-api`; these rows are external provider evidence, not a CUA/Hybrid
  capability estimate.

All 108 records passed the independent database oracle call, including rows
that stopped at a provider boundary. This is why the strict outcome remains a
joint requirement of reached task state, protocol completion, expected
verdict, and independent oracle agreement.

## Admission consequence

Invoice Ninja remains non-admitted. The two workflows improve workflow-level
variance and failure taxonomy, but the application still lacks the complete
eight-workflow subset, public manifest image/digest and license/redistribution
decision, and an all-slot three-arm admission gate. No candidate-only workflow
is added to the application denominator.
