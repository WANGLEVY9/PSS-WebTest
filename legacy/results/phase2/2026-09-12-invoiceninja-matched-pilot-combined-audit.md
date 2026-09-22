# Invoice Ninja matched pilot combined audit — 2026-09-12

Evidence boundary: two diagnostic matched rounds, not confirmatory evidence.
No application admission, repetition freeze, power decision, or model ranking
is inferred from these counts.

## Design and audit

- 2 independent repetitions per condition;
- conditions: clean-stable, functional-fault, UI evolution;
- strata: Playwright, Qwen Pure visual, Qwen Hybrid, DeepSeek Pure visual,
  DeepSeek Hybrid;
- one fresh Invoice Ninja reset before each condition/repetition block;
- 30 unique JSONL records, no duplicate IDs, ledger audit `status=ok`;
- each arm order was deterministically shuffled and recorded per block.

## Strict pass counts

| Condition | Playwright | Qwen visual | Qwen hybrid | DeepSeek visual | DeepSeek hybrid | Total |
|---|---:|---:|---:|---:|---:|---:|
| clean-stable | 2/2 | 1/2 | 2/2 | 2/2 | 2/2 | 9/10 |
| functional-fault | 2/2 | 0/2 | 2/2 | 2/2 | 2/2 | 8/10 |
| UI evolution | 2/2 | 0/2 | 2/2 | 2/2 | 2/2 | 8/10 |
| **all conditions** | **6/6** | **1/6** | **6/6** | **6/6** | **6/6** | **25/30** |

The five failed records are all Qwen Pure-visual records: one clean run and
both mutated-condition repetitions are `provider-format` failures; the one
clean success is retained rather than discarded. All failures remain in the
denominator and the independent database oracle still passed for those rows,
so they are protocol/provider failures rather than SUT reset failures.

## Interpretation boundary

This block provides stronger diagnostic evidence than the earlier single
repetition probes: Qwen Pure visual can complete the clean task occasionally,
but its fault/evolution performance is not stable under the current tool-call
protocol. Hybrid and DeepSeek visual completed this small block, while
Playwright provides the deterministic reference. The sample is still too
small, model strata are not exchangeable, and the task is only one workflow on
one application. These observations must not be promoted to a general claim
that Hybrid, DeepSeek, or Playwright is universally superior.

## Gate status

Invoice Ninja remains `candidate-not-admitted`. Before using this application
for pilot variance or confirmatory collection, repeat the same balanced block
with the frozen image/reset digest and the pre-specified minimum repetition
rule, then inspect latency, cost, action count, termination protocol, and
failure taxonomy in addition to strict success.
