# PrestaShop engineering pilot: DeepSeek V4.1-Flash visual/hybrid audit

Date: 2026-09-14  
Scope: **engineering/pilot only; excluded from the confirmatory denominator**

## Purpose

This run checks whether the repaired runner, observation-boundary contract, and
independent database oracle can execute the same authenticated PrestaShop
intent with a second vision provider. It is not a benchmark comparison and it
does not authorize power analysis or confirmatory collection.

## Matched intent and controls

- Application: PrestaShop local fixture, authenticated customer account.
- Task: search for `Mug` and finish when the visible results contain
  `Mug The adventure begins`.
- Condition: clean-stable; one reset state; same viewport and action budget.
- Visual arm: screenshot-only observation, coordinate/tool actions.
- Hybrid arm: screenshot plus the allow-listed visible-interactable structure;
  semantic target IDs were resolved by the runner, with no evaluator state.
- Oracle: independent MariaDB query over `ps_product_lang`; the provider never
  received the query or database result.

## Results

| Arm | Run record | Status | Actions | Retries | Wall time | Task state | Independent oracle |
|---|---|---:|---:|---:|---:|---|---|
| Pure visual | `code/artifacts/phase2/prestashop-engineering-deepseek-visual-simple-20260914-r2.jsonl` | completed | 3 | 0 | 6.17 s | reached (`search-results`) | passed |
| Hybrid | `code/artifacts/phase2/prestashop-engineering-deepseek-hybrid-simple-20260914-r2.jsonl` | completed | 4 | 1 | 9.83 s | reached (`search-results`) | passed |

The hybrid trace contains one repeated target click followed by a retry and a
successful type action. This is retained as a diagnostic retry, not hidden
from the outcome. Both records contain replay frames and provider-event
summaries; no key material is written.

## Configuration-boundary finding

An earlier attempt overrode only `CUA_PROVIDER`/`CUA_MODEL` while the runner
continued loading the Alibaba endpoint from `.env`, producing a 404 “Model not
exist” before any action. The attempt is classified as `provider-api /
configuration`, not as a CUA capability failure. The successful rerun loaded
the local `.env.deepseek` profile, preserving the frozen
`deepseek-v4-flash-vision-tool-v1` protocol.

## Interpretation and next gate

This evidence shows that both repaired agent paths are runnable on this local
fixture with the DeepSeek profile. It does **not** establish general
reliability, superiority, or a confirmatory effect. Before any larger pilot,
repeat this matched cell across pre-registered clean/evolution/fault
conditions, verify reset and oracle evidence for every repetition, and keep
provider/model strata separate. The global confirmatory gate remains closed
until outcome-blind screening, benchmark reset/evaluator gates, and Traditional
adaptation are complete.

## Medium-workflow follow-up

The same profile and fixture were then used for the medium intent (search, then
open the visible product detail page):

| Arm | Run record | Status | Actions | Retries | Wall time | Task state | Independent oracle |
|---|---|---:|---:|---:|---:|---|---|
| Pure visual | `code/artifacts/phase2/prestashop-engineering-deepseek-visual-medium-20260914.jsonl` | completed | 4 | 0 | 8.86 s | reached (`product-detail`) | passed |
| Hybrid | `code/artifacts/phase2/prestashop-engineering-deepseek-hybrid-medium-20260914.jsonl` | completed | 5 | 1 | 11.18 s | reached (`product-detail`) | passed |

Hybrid again needed one diagnostic re-plan after a repeated target click; the
retry is present in the run record. These four runs establish runner/provider
feasibility for this fixture and two task lengths only. They are not sufficient
to estimate a repetition rate or to support a method ranking.
