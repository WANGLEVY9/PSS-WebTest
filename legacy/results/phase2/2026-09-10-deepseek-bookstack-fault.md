# DeepSeek BookStack persistence-fault pilot (2026-09-10)

This is a single-repetition provider-stratified pilot, not confirmatory collection.

## Frozen cell

- Application: BookStack
- Workflow: create page under a seeded persistence-mismatch fault
- Condition: `functional-fault:persistence-mismatch`
- Repetition: 1
- Provider/model: `deepseek` / `deepseek-flash`
- Arms: Playwright accessibility-locator, pure visual CUA, hybrid visual+page-structure

## Result

| arm | reset/fault gate | protocol completed | emitted verdict | independent persistence oracle | cell passed |
|---|---|---|---|---|---|
| Playwright | pass | pass | fault | fault | pass |
| Hybrid | pass | pass | fault | fault | pass |
| Pure visual | pass | pass | fault | unknown | fail |

Matched result: **2/3 cells passed**. The pure-visual arm is not counted as correct fault detection because the independent oracle did not observe a stable fault state, even though the agent emitted `fault`. This preserves the separation between agent verdict and ground truth.

Raw screenshots, replay frames, provider summaries, and run-record ledgers remain local ignored artifacts. This public summary contains no credentials or API key.
