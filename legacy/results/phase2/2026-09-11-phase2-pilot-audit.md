# Phase 2 pilot audit — 2026-09-11

Status: diagnostic/pilot evidence only. Confirmatory collection remains frozen.

## Counted aligned records

The current aligned PrestaShop subset contains 45 unique run records across one workflow, three conditions, three provider/model strata, and three arms. The local ledger audit reports no duplicate run IDs or missing arm records.

| Condition | Visual CUA | Hybrid | Playwright | Total |
|---|---:|---:|---:|---:|
| clean-stable, 3 repetitions per provider | 0/9 | 6/9 | 9/9 | 27 |
| behavior-preserving UI evolution, 1 repetition per provider | 0/3 | 2/3 | 3/3 | 9 |
| functional fault, 1 repetition per provider | 0/3 | 0/3 | 3/3 | 9 |
| **All counted pilot records** | **0/15** | **8/15** | **15/15** | **45** |

The numerator is a strict completed arm record with a matching independent oracle and required protocol verdict. It is not a claim that a model or arm is universally better or worse.

## Failure attribution observed so far

- Pure visual CUA: clean and evolution blocks reached either `grounding-loop` or `agent-step-budget`; the fault block reached `grounding-loop` for Qwen and DeepSeek.
- Hybrid: Qwen and DeepSeek completed the clean/evolution search task in the current subset; the fault block stopped at `grounding-loop`. Doubao remained `provider-format` in the observed agent blocks.
- Playwright: all 15 aligned records completed the visible condition-specific oracle, including three independent fault detections.
- The first fault failure was a benchmark-definition mismatch (the runner expected the default Mug while the mutation renamed `Pack Mug + Framed poster`). It was excluded from the ledger, fixed, and re-run. The remaining agent failures occur after that repair and are therefore retained as observed provider/agent boundaries.

## Scope boundary

These 45 records cover one PrestaShop workflow only. They do not satisfy the planned 30-application or 3,000-record target, do not freeze repetition counts, and do not authorize power simulation or confirmatory collection. The target design remains 30 applications × 8 workflows × 3 conditions × 3 arms × 2 pilot repetitions = 4,320 minimum-core executions, with 14-repetition confirmatory target = 30,240 executions. At present, 0 applications and 0 workflow slots are admitted/frozen.

## Next gated work

1. Preserve this ledger and rerun the corrected fault block only after a registered provider/agent fix or framework replication; do not overwrite prior evidence.
2. Complete medium/long task adapters and condition-specific traditional baselines for the currently admitted-candidate SUTs.
3. Admit the next application only after reset digest, clean negative control, seeded fault positive control, evolution invariant, independent oracle, and all three-arm matched pilot gates pass.
4. Run Browser Use, AgentLab, and Stagehand as separately labelled framework strata after replay/run-record conformance; do not pool them with the native adapter.
5. Freeze pilot variance and power simulation only after enough admitted cells have stable denominators.
