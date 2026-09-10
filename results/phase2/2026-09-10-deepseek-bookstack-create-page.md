# DeepSeek BookStack create-page matched pilot (2026-09-10)

This is a single-repetition provider-stratified pilot, not confirmatory collection.

## Frozen cell

- Application: BookStack
- Workflow: authenticated create page and independently verify persisted content
- Condition: clean-stable
- Repetition: 1
- Provider/model: `deepseek` / `deepseek-flash`
- Arms: Playwright accessibility-locator, pure visual CUA, hybrid visual+page-structure

## Result

| arm | reset | protocol completed | independent persistence oracle | cell passed | actions | retries |
|---|---|---|---|---|---:|---:|
| Playwright | pass | pass | pass | pass | 10 | 0 |
| Hybrid | pass | pass | pass | pass | 7 | 0 |
| Pure visual | pass | pass | pass | pass | 8 | 0 |

Matched result: **3/3 cells passed**. No cell was admitted to confirmatory evidence; the run remains a feasibility/pilot observation and must be combined with provider/model-stratified repetitions and the pre-registered admission gate.

## Evidence boundary

The raw run-record ledger, replay frames, provider summaries, and screenshots are local ignored artifacts. This public summary contains only non-secret aggregate evidence; no API key or credentials are included.
