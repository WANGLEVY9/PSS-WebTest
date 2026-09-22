# PrestaShop three-provider matched pilot, repetition 3

Date: 2026-09-11  
Evidence boundary: three exploratory clean-stable repetitions; this is still pilot evidence and is not confirmatory.

## Gate and records

PrestaShop was reset and re-seeded before the repetition. All three provider
strata used the corrected benchmark task ID `prestashop-buyer-search-product`.
The ledger audit returned `status: ok`, 9 unique run IDs, and no missing-arm or
duplicate-ID errors.

| Provider/model | Pure visual | Hybrid | Playwright | DB oracle |
|---|---|---|---|---|
| Qwen3.7-Flash | failed: `grounding-loop` | completed | completed | 3/3 expected product |
| DeepSeek V4 vision | failed: `grounding-loop` | completed | completed | 3/3 expected product |
| Doubao Seed 2.1 | failed: `provider-format` | failed: `provider-format` | completed | 3/3 expected product |

Local ignored ledgers:

- `artifacts/phase2/run-records/2026-09-11-qwen-prestashop-matched-r3-aligned.jsonl`
- `artifacts/phase2/run-records/2026-09-11-deepseek-prestashop-matched-r3-aligned.jsonl`
- `artifacts/phase2/run-records/2026-09-11-doubao21-prestashop-matched-r3-aligned.jsonl`

## Pilot-level interpretation

The three clean repetitions provide an initial reliability signal for the
single short workflow, but not a final estimate. The repeated structure is
diagnostic: Playwright completed 3/3 in each provider-labelled block; Hybrid
completed 2/3 for Qwen and 2/3 for DeepSeek but 0/3 for Doubao; pure visual
failed all three provider strata in this workflow, with Qwen/DeepSeek showing
grounding-loop or step-budget boundaries and Doubao showing provider-format
failures. The independent database oracle returned the expected product on all
27 arm records across repetitions 1–3.

These observations are not pooled into a universal ranking. They are one task,
one clean condition, three repetitions, and three labelled provider strata.
Fault, UI-evolution, longer tasks, cross-page tasks, and alternate traditional
baselines remain unmeasured in this pilot.

## Required next work

1. Audit the bounded raw response summaries for the Doubao format boundary and
   run an adapter-only replay before changing any success label.
2. Inspect Qwen/DeepSeek visual replay frames for coordinate normalization versus
   genuine grounding loops; preserve the observed failures if the harness is
   correct.
3. Run the same three-arm block under one isolated functional fault and one
   behavior-preserving UI evolution after the mutation gate.
4. Use all three clean repetitions plus those condition strata for variance and
   power simulation; do not freeze the 14-repetition target from this pilot
   alone.
