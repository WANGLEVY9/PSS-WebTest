# DeepSeek BookStack search-and-open-book2 pilot (2026-09-10)

This is a single-repetition provider-stratified pilot, not confirmatory collection.

## Frozen cell

- Application: BookStack
- Workflow: authenticated search/navigation to `Book2`
- Condition: clean-stable
- Repetition: 1
- Provider/model: `deepseek` / `deepseek-flash`
- Arms: Playwright accessibility-locator, pure visual CUA, hybrid visual+page-structure

## Result

| arm | reset | protocol completed | independent UI oracle | cell passed | failure boundary |
|---|---|---|---|---|---|
| Playwright | pass | pass | pass | pass | none |
| Hybrid | pass | pass | pass | pass | none |
| Pure visual | pass | no | no | no | `grounding-loop`: repeated non-progressing click at a fixed screen coordinate |

Matched result: **2/3 cells passed**. The visual failure is classified as an agent grounding/progress failure because the provider returned successfully and the SUT reset/oracle gates passed. It is not promoted to a provider outage or infrastructure failure.

Raw screenshots, replay frames, provider summaries, and the run-record ledger remain local ignored artifacts. This public summary contains no credentials or API key.
