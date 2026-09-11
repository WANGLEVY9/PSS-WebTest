# PrestaShop multi-model matrix canary (2026-09-11)

## Scope

This is a reset-isolated diagnostic canary for the provider/model matrix. It is **not** a matched three-arm admission block and must not be pooled into confirmatory estimates. Both runs used the same PrestaShop clean reset, the same `complex` search → open → back → reopen intent, the same independent MySQL product oracle, and the Aliyun `qwen3.7-flash` profile.

The matrix is registered in `code/config/prestashop-agent-model-matrix.v0.1.json`. DeepSeek V4.1-Flash and Doubao Seed are registered as separate strata but remain fail-closed until their own local API keys are configured; no result is imputed for either.

## Observed runs

| Arm | Provider/model | Actions | Wall time | Independent oracle | Outcome | First observed boundary |
|---|---|---:|---:|---|---|---|
| pure visual | aliyun / qwen3.7-flash | 2 | 7.84 s | database search passed | failed | `grounding-loop` at repeated coordinate; page stayed authenticated home |
| hybrid | aliyun / qwen3.7-flash | 4 | 8.40 s | database search passed | failed | `oracle`/task-state boundary: product detail reached once, but no back-and-reopen milestone |

Run records were appended to the ignored local ledger `artifacts/phase2/prestashop-matrix-aliyun-canary-records.jsonl`; replay frames remain under the ignored `artifacts/phase2/replays/` directory. No credentials or raw provider responses are included in this report.

## Attribution

- Reset, login, SUT reachability, and database oracle were healthy in both runs; these are not infrastructure exclusions.
- The visual failure is consistent with a model/grounding failure under the screenshot-only contract.
- The hybrid failure reached a valid detail page and emitted `pass` before the required revisit sequence. This is a planning/termination limitation, not a page-structure leak or oracle defect.
- The result supports continuing diagnostic optimization, but does not justify freezing repetitions or starting confirmatory collection.

## Next gate

Run separate canaries for each configured provider/model, then repeat the same complex task with matched reset blocks. Only a provider/model stratum that passes connectivity, replay completeness, independent oracle, and three-arm admission gates may enter a larger block. Provider/model strata remain isolated in all summaries.
