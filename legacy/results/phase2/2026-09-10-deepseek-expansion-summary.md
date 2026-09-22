# DeepSeek provider-stratified expansion summary (2026-09-10)

All entries below are exploratory/diagnostic pilot evidence. No application or workflow slot is admitted or frozen, and no confirmatory inference is made.

## Completed pilot cells

| application | workflow/condition | Playwright | Hybrid | Pure visual | matched block |
|---|---|---:|---:|---:|---:|
| BookStack | open-book / clean-stable | pass | pass | pass | 3/3 |
| BookStack | create-page / clean-stable | pass | pass | pass | 3/3 |
| BookStack | search-and-open-book2 / clean-stable | pass | pass | fail: grounding-loop | 2/3 |
| BookStack | open-book / layout evolution | pass | pass | pass | 3/3 |
| BookStack | create-page / persistence mismatch fault | pass | pass | fail: oracle unknown | 2/3 |
| OWASP Juice Shop | product search / clean-stable | pass | pass | fail: grounding-loop | 2/3 |
| Indico | create-event / clean-stable | pass | fail: execution/step diagnostic | fail: grounding-loop | 1/3 |

Aggregate over these seven matched blocks: **16/21 cells passed**. This is a descriptive pilot denominator only; it must not be used as a confirmatory effect estimate because task families, conditions, and applications are not yet balanced and repetition count is one per block.

## Failure boundaries retained

- `grounding-loop`: repeated non-progressing visual clicks on BookStack search, Juice Shop search, and Indico create-event.
- `oracle unknown`: Pure visual emitted `fault`, but the independent BookStack persistence oracle did not observe a stable fault state.
- `agent-step-budget`: Indico Hybrid semantic mode produced valid candidate IDs but repeated the create-event loop after navigation and exhausted the step budget.
- Earlier DeepSeek JSON-mode create-page run: HTTP 200 with non-JSON action content; the provider profile now uses Tool Calls with thinking disabled.

## Current study status

- SUTs exercised: BookStack, OWASP Juice Shop, Indico.
- Provider/model stratum: DeepSeek `deepseek-flash` only for this expansion batch.
- Three-arm matched pilot evidence exists, but no workflow has passed a preregistered multi-repetition admission gate.
- Repetition freezing, power simulation, and confirmatory collection remain blocked until pilot variance and failure remediation are complete.

Raw ledgers, screenshots, replays, and provider summaries remain local ignored artifacts; this public summary contains no credentials or API key.
