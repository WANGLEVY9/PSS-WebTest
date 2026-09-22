# PrestaShop clean matched canary (2026-09-12)

Evidence boundary: three exploratory clean-stable repetitions per arm per
provider stratum, plus a 100-repetition scale-up launched separately. This is
pilot/admission evidence. It is not a strategy comparison and not confirmatory.

## Setup

- Orchestrator: `code/scripts/prestashop-matched-pilot.mjs`
  (`npm run pilot:prestashop:matched`). It resets the SUT, runs the three arms in
  a per-repetition randomised order derived from
  `sha256(seed|repetition|arm)`, and writes one aligned append-only ledger per
  provider stratum.
- Task: `prestashop-buyer-search-product` (simple), condition `clean-stable`,
  expected verdict `clean`.
- Protocol: resolved from `provider-profile-manifest.v0.1.json` with
  `PSS_REQUIRE_FROZEN_PROFILE=1`.
- Reset policy for the canary: `per-arm` (strictest). The scale-up uses
  `per-block` with `block_size=100`, matching the declared
  `reset_isolation: reset-before-each-cell-block`.

## Canary result (3 repetitions per arm)

| Provider/model | Pure visual | Hybrid | Playwright | Total |
|---|---:|---:|---:|---:|
| `aliyun/qwen3.7-flash` | 3/3 | 3/3 | 3/3 | **9/9** |
| `deepseek/deepseek-v4-flash-vision-exp` | 3/3 | 3/3 | 3/3 | **9/9** |
| `volcengine/doubao-seed-2-1-pro-260628` | — | — | — | **blocked (429)** |

All 18 executed cells reached `status=completed` with `emitted_verdict=clean`,
the independent database oracle passed, and no reset retry was used. Observed
wall time per execution: Playwright 0.8–1.0 s, pure visual 5.4–9.7 s, hybrid
6.2–11.2 s. Mean action counts: 3 for Playwright and pure visual, 4 for
DeepSeek hybrid.

Ledgers (local, ignored from version control):

- `artifacts/phase2/run-records/2026-09-12-aliyun-qwen3.7-flash-prestashop-clean-stable-canary-canary-r3-aligned.jsonl`
- `artifacts/phase2/run-records/2026-09-12-deepseek-deepseek-v4-flash-vision-exp-prestashop-clean-stable-canary-canary-r3-aligned.jsonl`

Ledger audit (`npm run records:audit`) returned `errors: []` for both files,
with three completed records per arm and no duplicate run ids.

## Why this matters

The previous aligned block reported pure visual at **0/15**. After the protocol
normalization described in
[`2026-09-12-provider-protocol-normalization.md`](2026-09-12-provider-protocol-normalization.md),
the same arm on the same workflow now completes 6/6 across the two ready
provider strata. This is direct evidence that the earlier zero was produced by
a **protocol confound** (an inherited `CUA_ALIYUN_ACTION_MODE=json` and an
implicit Volcengine `json` default), not by a screenshot-only capability limit.

It does **not** establish that pure visual is reliable in general. The task is
three actions long, read-only, and single-page. The earlier multi-step evidence
(complex search-revisit workflows, `grounding-loop` and step-budget
exhaustion) still stands as a retained failure boundary.

## Reset provenance boundary

PrestaShop's lifecycle emits `{"status":"seed-verified","counts":[3,19,5,6]}`
and `{"status":"reset-complete"}` but **no cryptographic reset digest**, unlike
BookStack's `6246d6dbf78b…`. The matched orchestrator therefore records
`reset_seed_counts` plus the attempt history and sets `reset_digest: null`
rather than inventing a digest. Pinning a PrestaShop image/database digest
remains an open admission gate, and it is recorded as an open item rather than
papered over.

## Scale-up

A 100-repetition per arm per provider run was launched from the same
orchestrator with `PSS_RESET_POLICY=per-block PSS_RESET_BLOCK_SIZE=100` for the
`aliyun` and `deepseek` strata (600 planned executions). Its progress log is
`artifacts/phase2/2026-09-12-clean-scaleup-r100.log`; per-stratum summaries are
written as `…-scaleup-r100-pilot.json`. Results are reported separately in
`2026-09-12-prestashop-clean-scaleup.md`.

## Next work

1. Complete the scale-up and summarise it per provider stratum.
2. Run the functional-fault and behaviour-preserving-evolution conditions on
   the same workflow once the mutation gate is re-verified.
3. Resolve the Doubao account boundary so the third stratum can be admitted.
4. Pin a PrestaShop image/database digest to close the reset-provenance gap.
