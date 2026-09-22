# BookStack DeepSeek create-page boundary pilot

## Scope

This pilot extends the provider-profile repair to the BookStack persistence
workflow. Each condition used one reset-isolated matched repetition with the
same three arms and the independent persisted-state oracle.

| Condition | Playwright | Pure visual | Hybrid | SUT/oracle gate |
|---|---:|---:|---:|---|
| clean-stable | 1/1 | 0/1, grounding-loop | 0/1, provider-format (`CTRL+A` guard) | pass |
| functional-fault:persistence-mismatch | 1/1 | 0/1, grounding-loop | 0/1, provider-format (`CTRL+A` guard) | pass |
| ui-evolution:bookstack-layout-v1 | 1/1 | 0/1, grounding-loop | 0/1, provider-format (`CTRL+A` guard) | pass |

The three artifacts are:

- `artifacts/phase2/bookstack-create-page-clean-stable-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-bookstack-deepseek-create-clean-profile-fix-pilot.json`
- `artifacts/phase2/bookstack-create-page-functional-fault-persistence-mismatch-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-bookstack-deepseek-create-fault-profile-fix-pilot.json`
- `artifacts/phase2/bookstack-create-page-ui-evolution-bookstack-layout-v1-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-bookstack-deepseek-create-evolution-profile-fix-pilot.json`

## Interpretation

All resets produced the expected digest and all condition preflights were
clean. Playwright reached the expected clean or fault oracle state in every
condition. The agent failures occurred after the application was reachable:
Hybrid repeatedly attempted to type into the default title field without the
required clear action and was stopped by the declared guard; Pure visual
repeated the same coordinate without visible progress. These are valid
provider/grounding observations under the current frozen protocol, not reset
or oracle contamination.

This remains pilot evidence. It does not admit BookStack, freeze repetitions,
or authorize confirmatory collection. The failure-boundary result is useful for
the conditional research question and should be retained even if later agent
protocol improvements are evaluated as a separately labelled stratum.
