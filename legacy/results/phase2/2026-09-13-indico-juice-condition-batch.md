# T1 condition batch (two-repetition pilot)

**Batch:** `phase2-t1-condition-batch-20260913b`
**Evidence boundary:** T1 pilot / variance-input diagnostics only.
**Authorization:** No application admission, repetition freeze, power freeze, or confirmatory collection is authorized.

## Design and execution

The batch attempted eight sequential blocks: Indico and Juice Shop × Qwen3.7-Flash and DeepSeek V4-Flash-Vision-Exp × functional fault and UI evolution. Each block requested two independent repetitions and all three arms (Pure visual, Hybrid, Playwright), for 48 planned records. A shared SUT was never exercised concurrently; every arm used a fresh lifecycle reset, condition mutation, independent oracle, and append-only run-record ledger.

| Application | Provider/model | Condition | Planned | Observed | Strict passes | Failure boundary summary |
|---|---|---|---:|---:|---:|---|
| Juice Shop | Qwen3.7-Flash | functional fault | 6 | 6 | 2 | visual grounding-loop ×2; hybrid agent-step-budget ×2 |
| Juice Shop | Qwen3.7-Flash | UI evolution | 6 | 5 | 2 | visual grounding-loop ×2; hybrid grounding/oracle ×1 |
| Juice Shop | DeepSeek V4-Flash-Vision-Exp | functional fault | 6 | 5 | 3 | visual grounding-loop ×2; one Hybrid arm-level record absent |
| Juice Shop | DeepSeek V4-Flash-Vision-Exp | UI evolution | 6 | 6 | 4 | visual agent-step-budget ×1; grounding-loop ×1 |
| Indico | Qwen3.7-Flash | functional fault | 6 | 6 | 2 | visual grounding-loop ×2; Hybrid independent-oracle failure ×2 |
| Indico | Qwen3.7-Flash | UI evolution | 6 | 6 | 2 | visual grounding-loop ×2; Hybrid execution boundary ×2 |
| Indico | DeepSeek V4-Flash-Vision-Exp | functional fault | 6 | 6 | 2 | visual grounding-loop ×2; Hybrid independent-oracle failure ×2 |
| Indico | DeepSeek V4-Flash-Vision-Exp | UI evolution | 6 | 6 | 2 | visual grounding-loop ×2; Hybrid independent-oracle failure ×2 |
| **Total** |  |  | **48** | **46** | **19** | two repetition-level ledger gaps remain |

The Qwen Juice Shop UI-evolution block also lacks one arm-level record. The missing records are not imputed, converted to failures, or silently dropped from the planned denominator; they are retained as an incomplete-ledger boundary. The batch controller exited with `block_failures=0` at the process level, but its manifest correctly reports `observed_records=46` versus `expected_records=48`; process success is therefore not evidence of matched-cell completeness.

## Interpretation

The larger pilot reinforces a conditional pattern without establishing a population ranking: scripted Playwright completed every observed eligible execution, pure visual repeatedly failed at grounding or budget boundaries, and Hybrid varied by SUT, provider, and condition. Because two cells are incomplete at the repetition level and each observed cell has only two repetitions, these counts cannot freeze repetition numbers or support confirmatory claims. The Hybrid contrast between DeepSeek Juice Shop and Indico is specifically a reason to preserve application and provider interactions in the later model rather than pool the arms.

## Required follow-up before using this tranche for variance

1. Backfill the two missing arm-level records with fresh resets under new run tags, while retaining this incomplete batch unchanged.
2. Add repetition-aware ledger validation that requires exactly three unique arms for every `randomization_block`, not merely one arm of each type somewhere in a cell.
3. Inspect the missing-child boundary (provider process exit, browser launch, or runner exception) from captured stderr/replay evidence before labeling it a model failure.
4. Repeat the same clean/fault/evolution strata at the pre-specified pilot size; only then run power simulation and freeze repetitions.

The matched orchestrators now fail closed by appending an explicit
`infrastructure-error` run record with `failure_category=environment` when an
agent child exits without returning a run record. This repairs ledger
accounting for future batches without retroactively inventing the two missing
records in this batch.

## Artifacts

- `artifacts/phase2/phase2-t1-condition-batch-20260913b-manifest.json`
- `artifacts/phase2/phase2-t1-condition-batch-20260913b.jsonl`
- `results/phase2/2026-09-13-indico-juice-condition-batch-metrics-summary.json`
- `artifacts/phase2/*phase2-t1-condition-batch-20260913b*records.jsonl`
