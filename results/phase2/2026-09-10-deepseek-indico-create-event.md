# DeepSeek Indico create-event pilot (2026-09-10)

This is provider-stratified feasibility/diagnostic evidence, not confirmatory collection.

## SUT gate

- Indico 3.3.6 local deployment became ready.
- Reset seed verified `event_count=18` with reset digest.
- Local experiment account was recreated by the lifecycle script; credentials are not included here.
- Independent relational oracle was clean before each attempted cell.

## Initial matched pilot

| arm | reset/clean gate | protocol completed | independent relational oracle | cell passed | observed boundary |
|---|---|---|---|---|---|
| Playwright | pass | pass | pass | pass | none |
| Pure visual | pass | no | no | no | `grounding-loop` after 3 actions |
| Hybrid | pass | no | no | no | execution boundary before the first pilot run-record |

## Hybrid engineering diagnostic

The Hybrid arm was replayed with the registered semantic candidate-id profile. This removed the missing-coordinate/format boundary: all emitted clicks used declared `target_id` values. However, the agent then repeated a create-event loop, returned to the home page, and reached the 18-step budget without a valid event oracle. The resulting run-record classified this as `agent-step-budget`, not provider timeout or SUT reset failure.

## Interpretation

Indico is not admitted or frozen. The evidence separates two actionable issues: coordinate-mode output validation should remain avoided for this model, while the remaining semantic-mode failure is a planning/termination problem requiring task-specific progress guards before more repetitions are useful.

Raw screenshots, replay frames, provider summaries, and run-record ledgers remain local ignored artifacts. This public summary contains no credentials or API key.
