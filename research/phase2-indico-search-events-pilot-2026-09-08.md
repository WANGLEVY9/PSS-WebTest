# Indico Search Events: Three-Arm Feasibility Cell (2026-09-08)

## Scope and provenance

This is one clean, **pilot-only** matched intent from WebTestPilot's Indico
`search_events.yaml` at commit `b0659bd9908f11c7957602a9372fc100dda50e40`.
The retained intent is to search for the literal `test`; the PSS harness adds
an independent, post-run visible-UI oracle.  The local fixture was reset and
verified as 18 seeded events under reset digest
`1ceb32dc749673dbbeaf7cff591f11b335419191cfdc3c568f889195e901be2d`.

The arms share the authenticated initial page, query, 1280x720 viewport, and
clean SUT image.  Authentication is fixture setup, not an action delegated to
an arm.  The actual query task is read-only, so the visual and hybrid cells
were safe to schedule concurrently after the reset witness was captured.

| Arm | Configuration | Budget | Strict cell result | Independent oracle | Observed boundary |
| --- | --- | --- | --- | --- | --- |
| Playwright | `scripted-playwright-accessibility-human-v2` | 5 scripted actions plus explicit render wait | pass | pass | completed in 1,429 ms |
| Pure visual | `visual-pss-native-aliyun-qwen3-vl-flash-v2` | 8 steps, 20 s/request | fail | pass | reached the search state, then exhausted the step budget without `done(pass)` |
| Hybrid | `hybrid-pss-native-aliyun-qwen3-vl-flash-v2` | 8 steps, 20 s/request | fail | fail | second click repeated an unchanged coordinate; harness stopped it as `grounding-loop` |

The Qwen provider/model is recorded only for the two agent arms.  It must not
be pooled with prior Ark/Doubao or legacy protocol strata.

## Oracle and record policy

`visible-ui-indico-search-v1` evaluates after the arm has stopped.  It checks
the exact `/search/?q=test` route, a visible `Search` heading, at least one
event link in `main`, and that every visible event-link title contains `test`
case-insensitively.  Neither the route condition nor oracle output is supplied
to either agent.

The first scripted attempt was retained in the ignored local ledger as an
`evaluator-error`: it performed the action sequence but evaluated before the
source task's explicit post-search wait.  The runner was corrected to wait for
the visible heading and first event link, then reset and rerun as the isolated
baseline above.  The original record is not rewritten and is excluded from any
matched result summary.

## Interpretation boundary

This cell is an implementation/admission observation, not a repetition,
effect-size estimate, or general comparative result.  It shows why the study
must report both task-state reachability and protocol-complete strict success:
the pure-visual agent completed the UI state but did not terminate correctly.
The next step is to collect further randomized repetitions only after the
current runner and reset checks remain stable; it is not valid to freeze power
or begin confirmatory collection from this single cell.
