# PrestaShop repaired matched repetition 4

Date: 2026-09-11  
Evidence boundary: exploratory repaired-pilot evidence; not an admission or confirmatory result.

## Reset gate

The clean and functional-fault conditions each started from an independent local
PrestaShop reset. The readiness gate returned HTTP 200 and the seed snapshot was
`[3,19,5,6]`. The database product oracle is independent of all testing arms.

## Clean-stable block

All nine provider-labelled executions completed and passed the independent oracle:

| Provider stratum | Pure visual | Hybrid | Playwright |
|---|---:|---:|---:|
| Qwen3.7-Flash | 1/1 | 1/1 | 1/1 |
| DeepSeek V4.1-Flash | 1/1 | 1/1 | 1/1 |
| Doubao Seed 2.1 Pro | 1/1 | 1/1 | 1/1 |

Raw records: `artifacts/phase2/run-records/2026-09-11-prestashop-*-matched-r4-clean-*.jsonl`.

The selected 9 clean records pass the ledger audit with no duplicate run IDs or
missing arms. The provider labels are retained in run IDs/provenance; they are
not collapsed into an arm-level universal estimate.

## Functional-fault block completed so far

The isolated `search-result-label-omission` mutation was applied only in the
fault condition. The Qwen stratum completed all three arms:

| Provider stratum | Pure visual | Hybrid | Playwright |
|---|---:|---:|---:|
| Qwen3.7-Flash | 0/1 (`agent-step-budget`, no verdict) | 1/1 | 1/1 |

The Qwen Pure Visual trace reached the fault attempt but exhausted its action
budget without emitting `fault`; the database oracle still passed. This is a
protocol/grounding failure, not an oracle failure. The result is retained as a
negative observation.

Raw records: `artifacts/phase2/run-records/2026-09-11-prestashop-qwen-matched-r4-fault-*.jsonl`.

The combined partial block (12 records: 9 clean plus 3 Qwen fault) also passes
the ledger audit. Its fault visual failure is counted as a failure, not removed
from the denominator.

## Qwen budget ablation

An additional reset-isolated Qwen Pure Visual fault run increased the action
budget from the profile's 12 steps to 18:

`prestashop-qwen-visual-budget-ablation-r1` → timeout, 18 actions, no emitted
verdict, independent database oracle passed.

The trace repeated the search/scroll loop and ended with a one-product visible
state rather than the fault verdict. Increasing the step budget alone therefore
did not resolve the failure; the current evidence points to grounding/progress
control and fault-state recognition, not only an insufficient numeric budget.
This ablation is diagnostic and is excluded from the matched denominator.

## Boundary and next action

This repetition strengthens two conclusions without establishing a ranking:

1. The repaired profiles can execute a short clean task across all three
   provider strata, so the old Pure Visual `0/15` cannot be attributed solely
   to intrinsic CUA impossibility.
2. Pure Visual remains less stable on the fault protocol: Qwen succeeded in an
   earlier repaired diagnostic but failed again here through step-budget
   exhaustion. One successful diagnostic is therefore not a reliability claim.

The DeepSeek/Doubao fault executions were not started in this round because
sending their screenshots (and Hybrid page structures) requires explicit
provider-specific authorization in the current task context. No missing runs
are converted into failures. Once authorized, execute the same fault block with
the existing reset and mutation contract, then audit the complete three-provider
repetition before any repetition or power decision.
