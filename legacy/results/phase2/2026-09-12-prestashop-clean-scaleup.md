# PrestaShop clean scale-up (partial, 2026-09-12)

Evidence boundary: admission/pilot evidence only. Every record is
`confirmatory: false`. The run was deliberately stopped before its planned
100-repetition target; this report records what was collected and why it stopped.

## Setup

- Orchestrator: `npm run pilot:prestashop:matched`
  (`code/scripts/prestashop-matched-pilot.mjs`).
- Target: 100 repetitions per arm per provider stratum = 600 executions across
  the `aliyun` and `deepseek` strata.
- Task `prestashop-buyer-search-product` (simple), condition `clean-stable`,
  expected verdict `clean`.
- Reset policy `per-block` with `PSS_RESET_BLOCK_SIZE=100`, matching the
  declared `reset_isolation: reset-before-each-cell-block` in
  `prestashop-agent-model-matrix.v0.1.json`. The block is counted in
  **executions**, not repetitions, so `block_size` keeps its declared meaning.
- Protocol resolved from the frozen manifest with `PSS_REQUIRE_FROZEN_PROFILE=1`.
- Ledger: `artifacts/phase2/run-records/2026-09-12-aliyun-qwen3.7-flash-prestashop-clean-stable-canary-scaleup-r100-aligned.jsonl`
- Log: `artifacts/phase2/2026-09-12-clean-scaleup-r100.log`

## Collected result (aliyun/qwen3.7-flash, 26 repetitions)

| Arm | Started | Strict passes | Failures | Mean wall time |
|---|---:|---:|---:|---:|
| Playwright | 26 | 26 | 0 | ~0.9 s |
| Pure visual | 26 | 26 | 0 | ~6–10 s |
| Hybrid | 26 | 26 | 0 | ~7–12 s |
| **Total** | **78** | **78** | **0** | — |

- Zero non-`completed` statuses, zero failure categories, zero reset failures.
- Wall time across all 78 records: min 772 ms, mean 6,243 ms, max 34,394 ms.
  The single 34 s outlier is one visual run that took 10 actions instead of 3.
- Ledger audit: `errors: []`, no duplicate run ids, three completed records per
  arm per repetition.

## Why the run was stopped at 26 of 100 repetitions

The clean condition is at **ceiling** (all arms 100%) and therefore carries no
discriminating information; the between-arm difference is 0.000 and the
stratified power simulation correctly returns zero power at every repetition
count. Continuing to 100 repetitions would add no scientific value while
occupying the SUT exclusively.

The fault and evolution conditions require SUT resets, and a reset recreates the
PrestaShop containers, which would kill the scale-up's in-flight executions.
Running the two kinds of block concurrently is therefore not possible. The
scale-up was stopped so the **fault** condition — the only condition that
separates the arms — could be collected. See
[`2026-09-12-prestashop-fault-detection.md`](2026-09-12-prestashop-fault-detection.md).

## What the partial scale-up does establish

1. **Runner stability at repetition scale.** 78 consecutive executions across
   three arms produced no infrastructure failure, no reset retry, and no
   protocol drift: every record carries
   `provider_profile_id=aliyun-qwen3.7-flash-tool-v1`, `action_mode=tool`,
   `api_mode=chat`.
2. **No within-block reset drift.** The block policy resets once per 100
   executions; the SUT remained healthy and the oracle stayed stable across the
   block.
3. **The clean task is genuinely saturated for this fixture**, which is itself a
   design finding: this workflow cannot be used to estimate arm differences.

## What it does not establish

- No variance estimate and no effect estimate. The condition is at ceiling.
- No cross-application evidence: one application, one workflow.
- The `deepseek` stratum was not reached before the stop.

## Resuming

Run ids now include the run tag, so a resumed block cannot collide with this
ledger. To continue:

```sh
cd code
PSS_MATCHED_REPETITIONS=74 PSS_RESET_POLICY=per-block PSS_RESET_BLOCK_SIZE=100 \
PSS_MATCHED_PROVIDERS=deepseek PSS_PILOT_RUN_TAG=scaleup-r100-deepseek \
  npm run pilot:prestashop:matched
```

Note that `PSS_MATCHED_REPETITIONS` restarts numbering at `r01`; the new run tag
keeps the two ledgers separate, and the repetition index is scoped to its run
tag rather than being a global counter. Anyone resuming should treat the two
ledgers as separate blocks and not pool them.

## Recommendation

Do not spend further SUT time on the clean condition for this workflow. The
scientific return is in the fault condition and in **additional applications**,
not in more repetitions of a saturated task. This is the same conclusion the
arbitration report reaches from the variance side.
