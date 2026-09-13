# Invoice Ninja matched pilot — ledger repair and final aggregate block

Date: 2026-09-13

Status: pilot/diagnostic evidence; not confirmatory.

## Ledger repair

The first 18-execution controller round reused fixed arm-only JSONL paths and
run IDs. A later audit found duplicate IDs from historical rounds; that round
is retained as `invalid-ledger` infrastructure evidence. A second rerun made
IDs unique but still wrote one file per arm, so each file contained only a
partial matched cell. It is also excluded from aggregate analysis.

The controller was then repaired to include the campaign tag in every run ID
and to write one append-only aggregate JSONL for the whole round. The final
aggregate audit reports 18 records, 18 unique run IDs, three conditions, six
model/arm strata, and no malformed or duplicate records.

## Final aggregate block

Task: `invoiceninja-view-invoice-details`  
Conditions: clean-stable, functional-fault, ui-evolution  
Strata: Playwright; Qwen visual/Hybrid; DeepSeek visual/Hybrid; Doubao Hybrid  
Repetitions: one independent SUT reset per condition

| Stratum | Clean | Fault | UI evolution | Total strict |
|---|---:|---:|---:|---:|
| Playwright | 1/1 | 1/1 | 1/1 | 3/3 |
| Qwen visual | 1/1 | 0/1 grounding-loop | 0/1 provider-format | 1/3 |
| Qwen Hybrid | 1/1 | 1/1 | 1/1 | 3/3 |
| DeepSeek visual | 1/1 | 1/1 | 1/1 | 3/3 |
| DeepSeek Hybrid | 1/1 | 1/1 | 1/1 | 3/3 |
| Doubao Hybrid | 0/1 provider-api | 0/1 provider-api | 0/1 provider-api | 0/3 |

Overall strict pass is 13/18. The Doubao rows are account/quota-blocked and
must not be interpreted as capability failures. Qwen visual's two failures are
retained with their observed provider-format/grounding boundaries. The result
is a single-task, one-repetition pilot stratum: it informs failure taxonomy and
variance planning, but cannot admit Invoice Ninja or freeze repetitions.

Aggregate ledger:
`code/artifacts/phase2/invoiceninja-matched-phase2-t1-invoiceninja-aggregate-20260913-aggregate.jsonl`.

The sanitized aggregate JSONL is also mirrored for repository audit at
`artifacts/phase2/invoiceninja-matched-phase2-t1-invoiceninja-aggregate-20260913-aggregate.jsonl`.

Generated controller report:
`results/phase2/2026-09-13-invoiceninja-matched-pilot-phase2-t1-invoiceninja-aggregate-20260913.md`.
