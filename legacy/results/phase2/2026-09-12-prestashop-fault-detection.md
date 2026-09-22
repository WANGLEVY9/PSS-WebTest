# PrestaShop functional-fault detection and evolution blocks (2026-09-12)

Evidence boundary: three exploratory repetitions per arm per provider stratum,
one workflow, one mutation per condition. Pilot/admission evidence only. Not a
strategy comparison, not confirmatory, and not pooled across provider strata.

## Condition gate

`npm run gate:prestashop:fault-evolution` re-ran before the blocks and passed for
both mutations:

| Mutation | Condition | Applied | Invariant | Isolation |
|---|---|---|---|---|
| `search-result-label-omission` | `functional-fault` | target `Pack Mug + Framed poster` no longer visible; replacement `Framed Poster` visible | database rows unchanged | clean context unaffected |
| `search-layout-preserving-v1` | `ui-evolution` | style marker present | target identity and product count unchanged | clean context unaffected |

## Two real defects found and fixed before the block could run

### 1. Benchmark-definition mismatch (expected product vs mutation target)

The first attempt (`fault-r3`) failed every cell. Diagnosis: the fault mutation
renames **`Pack Mug + Framed poster`**, while the task's expected product was
**`Mug The adventure begins`**. With a misaligned expected product the renamed
product is still present, so every agent arm correctly reported `clean` — and
that correct verdict was then scored as an oracle failure. This is the same
defect recorded on 2026-09-11 and it had not been fixed at the source.

**Fix:** `prestashop-matched-pilot.mjs` now derives the fault condition's
expected product from the mutation definition's `target_text` instead of relying
on a separate default. A fault mutation without a `target_text` is a hard error.

The misaligned block is retained as separate evidence under the run tag
`fault-r3`; it is not overwritten and not pooled. The corrected block is
`fault-r4`.

### 2. Cross-SUT environment leakage broke compose port interpolation

After the first attempt, every reset failed with:

```
Bind for 0.0.0.0:8082 failed: port is already allocated
```

Root cause: sourcing the Invoice Ninja profile (`third_party/WebTestPilot/webapps/invoiceninja/.env`)
exports `APP_PORT=8082` into the shell. PrestaShop's compose file interpolates
`${APP_PORT}:80`, and the **shell value wins over the compose directory's own
`.env`**, so PrestaShop tried to bind Invoice Ninja's port.

**Fix:** `webtestpilot-lifecycle.mjs` now merges the application's own env file
into the child process environment, so the application's `.env` always wins over
the ambient shell. Verified by deliberately re-exporting `APP_PORT=8082`:
PrestaShop still binds 8083 and Invoice Ninja remains on 8082.

This is a real reproducibility hazard for anyone running two SUT profiles in one
shell, and it is now fail-safe rather than silent.

## Functional-fault block (`fault-r4`)

Task `prestashop-buyer-search-product`, condition `functional-fault`, expected
verdict `fault`, mutation `search-result-label-omission`, 3 repetitions per arm.

| Provider/model | Pure visual | Hybrid | Playwright | Total |
|---|---:|---:|---:|---:|
| `aliyun/qwen3.7-flash` | 0/3 | 0/3 | 3/3 | **3/9** |
| `deepseek/deepseek-v4-flash-vision-exp` | 3/3 | 3/3 | 3/3 | **9/9** |

Failure detail for the Qwen stratum: all six agent cells ended
`status=timeout` with `emitted_verdict=not-emitted` and
`failure_category=agent-step-budget` after exhausting the 12-step budget. The
agent never emitted a usable verdict — it did not mis-report, it failed to
terminate.

DeepSeek completed the same task in 5 actions (visual) and 6 actions (hybrid)
with a correct `fault` verdict.

## Behaviour-preserving evolution block (`evolution-r3`)

Task `prestashop-buyer-search-product`, condition `ui-evolution`, expected
verdict `clean`, mutation `search-layout-preserving-v1`, 3 repetitions per arm.

| Provider/model | Pure visual | Hybrid | Playwright | Total |
|---|---:|---:|---:|---:|
| `aliyun/qwen3.7-flash` | 3/3 | 3/3 | 3/3 | **9/9** |
| `deepseek/deepseek-v4-flash-vision-exp` | 3/3 | 3/3 | 3/3 | **9/9** |

All 18 cells completed with a correct `clean` verdict, confirming again that
this CSS-only mutation preserves the task and the oracle on this fixture.

## Three-condition summary (Qwen stratum)

| Condition | Pure visual | Hybrid | Playwright |
|---|---:|---:|---:|
| clean-stable (canary, 3 reps) | 3/3 | 3/3 | 3/3 |
| ui-evolution (3 reps) | 3/3 | 3/3 | 3/3 |
| **functional-fault (3 reps)** | **0/3** | **0/3** | **3/3** |

The fault condition is the only condition that separates the arms in this
fixture. Clean and evolution are at ceiling for every arm and therefore carry no
discriminating information.

## Statistical honesty: n=3 does not separate the strata

Wilson 95% intervals for the fault condition:

| Stratum / arm | Rate | Wilson interval |
|---|---|---:|
| Qwen visual | 0/3 | [0.000, 0.561] |
| Qwen hybrid | 0/3 | [0.000, 0.561] |
| Qwen playwright | 3/3 | [0.439, 1.000] |
| DeepSeek visual / hybrid / playwright | 3/3 | [0.439, 1.000] |

The Qwen-visual and DeepSeek-visual intervals **overlap** in [0.439, 0.561].
The apparent 0/3-versus-3/3 difference is therefore **not yet distinguishable** at
this repetition count. Reporting it as a settled provider difference would be
premature; it is a directional planning signal.

## Power implication (planning input only)

`node scripts/power-simulation.mjs --mode stratified` on the Qwen fault block
(one cell per arm, so the between-cell variance is not estimable and the
declared sensitivity grid `{0, 0.02, 0.05, 0.10}` is swept):

| Contrast | Observed difference | Estimated power |
|---|---:|---|
| playwright vs visual | 1.000 | **1.000 at 4 repetitions/cell** for every swept τ |
| playwright vs hybrid | 1.000 | **1.000 at 4 repetitions/cell** for every swept τ |
| hybrid vs visual | 0.000 | 0.000–0.447 (no observed difference; uninformative) |

Two caveats must travel with this number:

1. A difference of 1.000 is the **maximum possible**. Real effects will be
   smaller, so 4 repetitions is a floor for the largest contrast, not a general
   answer.
2. Between-cell variance is not estimable from a single-application,
   single-workflow pilot. The sweep is a declared assumption, not a measurement.
   Multi-application data is required before any repetition count is frozen.

## Ledger audits

All four new ledgers return `errors: []` with three completed records per arm and
no duplicate run ids:

- `2026-09-12-aliyun-qwen3.7-flash-prestashop-functional-fault-canary-fault-r4-aligned.jsonl`
- `2026-09-12-deepseek-deepseek-v4-flash-vision-exp-prestashop-functional-fault-canary-fault-r4-aligned.jsonl`
- `2026-09-12-aliyun-qwen3.7-flash-prestashop-ui-evolution-canary-evolution-r3-aligned.jsonl`
- `2026-09-12-deepseek-deepseek-v4-flash-vision-exp-prestashop-ui-evolution-canary-evolution-r3-aligned.jsonl`

The failed `fault-r3` ledgers are retained separately and are not pooled.

## Boundaries

- One application, one workflow, one mutation per condition, one short task.
- The mutation is a **visible-text** rename; the independent database oracle is
  unchanged by design, so the fault is scored on the visible-state authority.
  A persisted-state fault family is still unimplemented for this SUT.
- The Qwen `agent-step-budget` outcome is a **termination/planning** boundary,
  not a mis-report. Whether a larger step budget would repair it is untested and
  must be a declared ablation, not a silent change.
- Provider strata are never pooled; the Qwen 3/9 and DeepSeek 9/9 rows are
  separate estimates.
- No record in this report is confirmatory.

## Next work

1. Re-run the fault block with more repetitions to separate the strata
   (the Wilson intervals currently overlap).
2. Test whether the Qwen `agent-step-budget` outcome is a budget artifact via a
   declared step-budget ablation.
3. Implement a persisted-state fault family so the fault condition can be scored
   against the database authority rather than visible text only.
4. Extend the fault and evolution blocks to a second application before any
   repetition count is frozen.
