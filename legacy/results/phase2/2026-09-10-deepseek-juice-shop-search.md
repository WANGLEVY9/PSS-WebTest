# DeepSeek Juice Shop product-search pilot (2026-09-10)

This is a single-repetition provider-stratified pilot, not confirmatory collection.

## Frozen cell

- Application: OWASP Juice Shop v20.0.0
- Workflow: product search and result verification
- Condition: clean-stable
- Repetition: 1
- Provider/model: `deepseek` / `deepseek-flash`
- Arms: Playwright accessibility-locator, pure visual CUA, hybrid visual+page-structure

## Result

| arm | reset/clean gate | protocol completed | independent search oracle | cell passed | failure boundary |
|---|---|---|---|---|---|
| Playwright | pass | pass | pass | pass | none |
| Hybrid | pass | pass | pass | pass | none |
| Pure visual | pass | no | no | no | `grounding-loop` |

Matched result: **2/3 cells passed**. The pure-visual failure was recorded as agent grounding/progress failure; the provider returned through the normal request path and the SUT reset/oracle gates were valid. This is not evidence that visual CUA universally fails, nor confirmatory evidence of a cross-application treatment effect.

Raw screenshots, replay frames, provider summaries, and the run-record ledger remain local ignored artifacts. This public summary contains no credentials or API key.
