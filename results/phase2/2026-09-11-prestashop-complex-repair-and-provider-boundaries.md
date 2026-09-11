# PrestaShop complex-task repair and provider-boundary audit (2026-09-11)

## Scope and evidence boundary

This is a diagnostic/pilot artifact for one authenticated PrestaShop workflow:

`Search for Mug -> open “Mug The adventure begins” -> Back -> reopen the same product.`

The run uses the normal three-arm contracts and the independent database oracle.
It is not confirmatory evidence and does not freeze repetition counts or admit
PrestaShop for the confirmatory panel.

All raw run records and replay files are append-only artifacts under
`artifacts/phase2/run-records/` and `artifacts/phase2/replays/`. Secrets and
credentials are not stored in either artifact class.

## Failure attribution before and after repair

### r8: infrastructure boundary, not an agent result

The first post-guard-fix complex block (`r8`) produced nine records with zero
agent actions. Every arm stopped during authentication while the sandbox could
not reach the host-published `localhost:8083` port. The records have
`independent_oracle_passed=true` only because the database fixture was intact;
they are not task successes. They are retained as infrastructure failures and
excluded from agent capability claims.

### PrestaShop reset/login repair

The local SUT was reachable in the host network, but authenticated POSTs
returned HTTP 500. The PrestaShop exception log identified
`Property Cart->date_add is not valid`: the fixture helper materialized a cart
with `0000-00-00 00:00:00` timestamps, which fails under the current strict
MySQL/PHP validation path. The lifecycle reset now normalizes only zero-date
`ps_cart` rows after the fixture account is created. A direct local repair made
the same condition explicit before the reruns; no task data or oracle query was
changed.

### Hybrid A-B-A navigation repair

The original pointer guard compared only the current screenshot digest and URL/
milestone token. After a legitimate `search-results -> product-detail ->
search-results` cycle, Hybrid's second click was incorrectly rejected as a
non-progressing repeat. Both drivers now maintain a harness-local observation
sequence. A repeated pointer is rejected only when the pointer, screenshot,
progress token, and observation sequence are all unchanged. The sequence is
not sent to the provider and does not weaken the screenshot-only or
screenshot-plus-structure contract.

## Repaired and provider-specific runs

| Run | Provider/model | Arm | Outcome | Diagnosis |
|---|---|---|---|---|
| r10 | Qwen3.7-Flash | pure visual | completed, checkpoint/oracle true | After SUT repair, the pure-visual agent reopened the product successfully. |
| r10 | deterministic script | Playwright | completed, checkpoint/oracle true | Six scripted actions; independent DB oracle true. |
| r10 | Qwen3.7-Flash | Hybrid | test-failure, 5 actions | **Pre-fix** guard rejection at `target_id=c22`; retained as a regression witness. |
| r11 | Qwen3.7-Flash | Hybrid | completed, checkpoint/oracle true | Same task succeeds after the A-B-A observation-sequence repair. |
| r12 | DeepSeek V4.1-Flash | pure visual | test-failure, grounding-loop | Repeated coordinate `(500,500)` at the authenticated home; no task checkpoint. |
| r12 | DeepSeek V4.1-Flash | Hybrid | timeout, checkpoint true, protocol false | Reached product detail but repeatedly replanned; failed termination within 12 steps. |
| r12 | deterministic script | Playwright | completed, checkpoint/oracle true | Script completed the same workflow. |
| r14 | DeepSeek V4.1-Flash | Hybrid, 20-step ablation | timeout, no checkpoint | Larger budget did not repair the repeated search/re-entry loop; this is a model grounding/termination boundary, not the harness guard. |
| r13 | Doubao Seed 2.1 Pro | pure visual | timeout, step budget | Repeated home/back/search clicks; no checkpoint. |
| r13 | Doubao Seed 2.1 Pro | Hybrid | provider-api failure | Ark returned HTTP 429: the account inference limit for the model was paused by Safe Experience Mode. |
| r13 | deterministic script | Playwright | completed, checkpoint/oracle true | Script completed the same workflow while the provider rows were isolated. |

The ledger audit over the repaired block reports 11 unique records, no duplicate
run IDs, and no missing arm labels. The independent product oracle is true for
all rows because the expected fixture product remains present; therefore the
agent failures are protocol/grounding/provider failures, not database-oracle
failures.

## Regression verification

`npm run test:contracts` passes **123/123** tests, including new tests for:

1. a legitimate A-B-A revisit in pure visual mode;
2. a legitimate A-B-A revisit in Hybrid semantic mode; and
3. preservation of the existing same-observation repeated-click rejection.

## Interpretation

The engineering blockers are now separated from provider/model boundaries:

* The zero-date cart and sandbox-host connectivity caused false execution
  failures and are engineering/infrastructure issues.
* Qwen's complex task is runnable in both visual and Hybrid modes after those
  repairs (one diagnostic repetition per successful arm).
* DeepSeek and Doubao still show model grounding/termination or provider-limit
  boundaries on this complex task. Increasing DeepSeek Hybrid from 12 to 20
  steps did not solve the loop.
* These observations support conditional failure analysis, not a universal
  ranking. More reset-isolated repetitions and additional workflows are needed
  before any confirmatory claim.
