# BookStack create-page pilot update (2026-08-24)

## Scope

One non-confirmatory matched repetition was run after the navigation task
stabilization changes, using the fixed Qwen3-VL-Flash provider, a 16-step
budget, a 30-second decision timeout, and three provider-decision retries.

## Result

| arm | reset/clean gate | agent execution | independent persistence oracle | cell |
|---|---|---|---|---|
| Playwright | pass | completed | 1 exact persisted page | pass |
| Pure visual | pass | timeout at 16 actions | oracle observed one persisted page, but agent did not terminate | fail |
| Hybrid | pass | completed | 1 exact persisted page | pass |

The artifact is
`artifacts/phase2/bookstack-three-arm-pilot.json`; the standard ledger is
`artifacts/phase2/bookstack-three-arm-records.jsonl`.

## Interpretation

This is not evidence that hybrid is universally better. It is a diagnostic
signal that the pure-visual arm can reach the persisted postcondition but may
fail to terminate after rich-text interaction. The independent oracle passing
does not override the execution timeout. The failure is classified as
planning/termination, not as an oracle success.

The task remains non-confirmatory. Repetition counts, repair effort, and
power are not frozen. The next useful pilot should repeat this task under the
same clean condition, then add the behavior-preserving layout mutation before
introducing locator repair or fault conditions.

## Subsequent rerun

A subsequent rerun with the same budget produced 3/3 successful arms,
including pure visual, but the latest condition-separated rerun produced 2/3:
the visual provider returned invalid tool-call JSON after reaching the persisted
oracle state, while Playwright and hybrid passed. All reset gates passed in the
latest rerun. The append-only ledger therefore shows genuine run-to-run
provider/planning variability. The correct conclusion is not a 100% success
rate; repeated clean repetitions are still required before evolution, repair,
or confirmatory collection.

The pilot power script was also corrected to use end-to-end `cell_passed`
(agent completion plus independent oracle), rather than counting an oracle-only
postcondition after a timeout. The current one-repetition planning output is
therefore intentionally unstable and must not be used to freeze repetitions.
