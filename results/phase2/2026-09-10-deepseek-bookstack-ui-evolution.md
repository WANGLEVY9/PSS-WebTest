# DeepSeek BookStack UI-evolution pilot (2026-09-10)

This is a single-repetition provider-stratified pilot, not confirmatory collection.

## Frozen cell

- Application: BookStack
- Workflow: authenticated open-book navigation
- Condition: `ui-evolution:bookstack-layout-v1`
- Mutation: behavior-preserving layout mutation (`bookstack-layout-v1`)
- Repetition: 1
- Provider/model: `deepseek` / `deepseek-flash`
- Arms: Playwright accessibility-locator, pure visual CUA, hybrid visual+page-structure

## Result

| arm | reset | protocol completed | independent UI oracle | cell passed |
|---|---|---|---|---|
| Playwright | pass | pass | pass | pass |
| Hybrid | pass | pass | pass | pass |
| Pure visual | pass | pass | pass | pass |

Matched result: **3/3 cells passed**. The result is retained as an exploratory evolution-stratum observation; it does not freeze repetition counts or start confirmatory collection.

Raw screenshots, replay frames, provider summaries, and the run-record ledger remain local ignored artifacts. This public summary contains no credentials or API key.
