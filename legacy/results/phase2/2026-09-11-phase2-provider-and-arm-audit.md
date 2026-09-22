# Phase 2 provider and three-arm audit

Date: 2026-09-11
Evidence boundary: diagnostic/pilot only; confirmatory collection remains frozen.

## Provider readiness

| Stratum | Local profile | Provider smoke | SUT task evidence | Current interpretation |
|---|---|---|---|---|
| Alibaba Qwen3.7-Flash | `code/.env` | existing visual/hybrid connectivity passed | 500-run visual + 500-run hybrid PrestaShop diagnostic blocks | ready for a new matched pilot; not admitted |
| DeepSeek V4 Flash Vision | `code/.env.deepseek` | current visual/hybrid synthetic driver smoke passed | 7 matched exploratory blocks / 21 cells reported as 16 passed; no large block | configured and runnable; matched repetition gate still open |
| Doubao Seed 2.1 Pro | `code/.env.volcengine-cua` | Responses API visual/hybrid smoke passed | legacy Doubao 2.0 artifacts only; no current 2.1 SUT task | configured and runnable; current-model matched pilot still required |

The main `code/.env` intentionally remains the active Qwen stratum. The other
profiles are ignored local files and must be selected explicitly so provider and
model strata cannot be mixed.

## Principal aligned diagnostic scale

The largest reset-block comparison is one PrestaShop clean workflow family with
200 simple, 175 medium, and 125 complex planned executions per arm:

| Arm | Observed | Task-state completed | Rate | Independent DB oracle |
|---|---:|---:|---:|---:|
| Pure visual CUA, Qwen3.7 | 500 | 256 | 51.2% | 500/500 |
| Hybrid Agent, Qwen3.7 | 500 | 381 | 76.2% | 500/500 |
| Accessibility-locator Playwright, high-load diagnostic | 500 | 426 | 85.2% | 426/426 completed |
| Accessibility-locator Playwright, low-load control | 60 | 60 | 100% | 60/60 |

These are not a matched three-arm estimate: the two agent arms used one worker
per reset block, whereas the 500-run Playwright batch used eight workers; the
low-load control is a separate capacity diagnostic. The two-agent comparison is
also missing the same-protocol Playwright reset blocks, so the ledger correctly
remains fail-closed.

## Additional provider-stratified pilot evidence

- DeepSeek: seven balanced exploratory blocks are summarized as 16/21 passed
  cells at one repetition per block. Raw local pilot artifacts also retain an
  earlier separate three-record protocol attempt; it is not pooled into the
  seven-block summary.
- Legacy Doubao 2.0: local pilot artifacts contain 33 arm records across
  BookStack, Indico, and Juice Shop, with 25 `cell_passed` flags. These are
  legacy/duplicate diagnostic variants and are not evidence for the current
  Doubao 2.1 Responses profile.
- Raw ignored artifacts currently occupy approximately 1.7 GB and include
  replay screenshots, provider summaries, JSONL ledgers, and run summaries.

## Not yet complete

1. A current-model, reset-matched three-arm pilot for each of Qwen, DeepSeek,
   and Doubao 2.1 on the same application/workflow/condition set.
2. Same-protocol Playwright blocks aligned with the agent reset-block policy.
3. A clean/fault/evolution matched pilot with all three arms and independent
   oracles for each admitted workflow.
4. Pilot variance estimates stratified by provider/model, complexity, oracle,
   and condition; no repetition count or power target is frozen.
5. Application admission. The 30-application/8-workflow/3-condition/14-run
   target remains a planning target; no application is currently admitted for
   confirmatory collection.

## Next execution order

1. Freeze the current three provider profiles, Responses/Chat API mode, prompt,
   action schema, retry policy, and concurrency policy in a versioned profile
   manifest.
2. Run the same PrestaShop clean workflow family as three separate provider
   strata. For each stratum, collect Playwright, visual, and hybrid from the
   same reset block, with complete per-step screenshot/URL/action/oracle
   records. Start with a small 3--5 repetition pilot, not a large batch.
3. Repair only pre-specified engineering boundaries: provider-format errors,
   coordinate conversion, replay persistence, and SUT health gates. Treat
   grounding/planning failures as agent outcomes and preserve them.
4. Repeat the matched pilot under one functional fault and one
   behavior-preserving UI evolution, after apply/remove/isolation checks pass.
5. Use the resulting pilot data for variance and power simulation. Freeze
   repetitions, primary outcomes, concurrency, exclusion rules, and analysis
   hashes only after the simulation is affordable and adequately powered.
6. Admit a second application only after its reset, independent oracle,
   fault/evolution invariant, and three-arm pilot pass. Cross-application tasks
   remain blocked until both endpoint applications are individually admitted.
7. Start confirmatory collection only when the large-scale validator reports
   `ready-for-confirmatory` and all fail-closed gates pass.
