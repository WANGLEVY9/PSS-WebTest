# Invoice Ninja matched pilot cumulative audit — 2026-09-12

Evidence boundary: diagnostic pilot evidence only. This cumulative ledger is
not a confirmatory estimate, does not admit Invoice Ninja, and must not be
used to claim a universal winner.

## Scope and audit

- 3 independent repetitions for clean-stable, functional-fault, and UI-evolution;
- fresh SUT reset before every condition/repetition block;
- 48 unique records, zero duplicate run IDs, ledger audit `status=ok`;
- Qwen and DeepSeek have three repetitions in each visual/Hybrid stratum;
- Doubao Hybrid was added in repetition 3 and has one provider-readiness
  record per condition; it was not available in repetitions 1–2.

## Model/arm strata

| Condition | Playwright | Qwen visual | Qwen hybrid | DeepSeek visual | DeepSeek hybrid | Doubao hybrid | Available total |
|---|---:|---:|---:|---:|---:|---:|---:|
| clean-stable | 3/3 | 1/3 | 3/3 | 3/3 | 3/3 | 0/1 blocked | 13/16 |
| functional-fault | 3/3 | 0/3 | 3/3 | 3/3 | 3/3 | 0/1 blocked | 12/16 |
| UI evolution | 3/3 | 0/3 | 3/3 | 3/3 | 3/3 | 0/1 blocked | 12/16 |
| **all recorded** | **9/9** | **1/9** | **9/9** | **9/9** | **9/9** | **0/3 blocked** | **37/48 strict passes** |

The three Doubao Hybrid rows are all `provider-api` failures caused by the Ark
inference-limit/Safe Experience Mode block. They are retained as external
availability evidence and excluded from capability pooling. The five Qwen
Pure-visual failures in the original two rounds plus three failures in round 3
are `provider-format` boundaries; Qwen Pure-visual succeeds once in the nine
available clean/mutated attempts, so it is not correct to label the arm
intrinsically impossible.

## Interpretation boundary

Within this one workflow and one SUT, Qwen Hybrid and both DeepSeek agent arms
were stable across this small block, while Qwen Pure-visual was condition and
protocol sensitive. Playwright was deterministic in these runs. This is useful
for diagnosing model/protocol boundaries and planning the next pilot, but the
application, workflow, and repetition count are still insufficient for
between-application inference or confirmatory analysis.

## Next gate

Keep the 48 records as pilot evidence. After Doubao is reactivated, complete
its missing two repetitions and rerun the same matched block. Then add a second
workflow on Invoice Ninja and repeat the three-arm/model strata before using
the resulting variance for power simulation. Confirmatory collection remains
frozen.
