# PrestaShop repaired UI-evolution and medium-workflow blocks

Date: 2026-09-11  
Evidence boundary: exploratory repaired-pilot evidence; not confirmatory and
not yet sufficient to freeze repetition counts.

## UI-evolution block

The condition used the previously gated, presentation-only mutation
`search-layout-preserving-v1`. Each provider stratum used the same short search
task and each arm received a fresh reset/seed state.

| Provider stratum | Pure visual | Hybrid | Playwright |
|---|---:|---:|---:|
| Qwen3.7-Flash | 1/1 | 1/1 | 1/1 |
| DeepSeek V4.1-Flash | 1/1 | 1/1 | 1/1 |
| Doubao Seed 2.1 Pro | 1/1 | 1/1 | 1/1 |

The mutation is presentation-only; the independent database oracle passed for
all nine records. The block passes the ledger audit with 9 unique IDs and all
three arms present.

## Medium clean workflow block

The medium task is `prestashop-search-open-product`: search for the target
product and open its detail page. Agents and the deterministic Playwright
runner used the same task ID, reset state, product oracle, and clean condition.

| Provider stratum | Pure visual | Hybrid | Playwright |
|---|---:|---:|---:|
| Qwen3.7-Flash | 1/1 | 1/1 | 1/1 |
| DeepSeek V4.1-Flash | 1/1 | 1/1 | 1/1 |
| Doubao Seed 2.1 Pro | 1/1 | 1/1 | 1/1 |

The medium block also passes the ledger audit with 9 unique IDs and all three
arms present. The Playwright rows are repeated deterministic script executions
for the provider-labelled matched strata; they do not call a model.

Raw records for both blocks are stored under:

`artifacts/phase2/run-records/2026-09-11-prestashop-*-matched-r5-evolution-*.jsonl`

`artifacts/phase2/run-records/2026-09-11-prestashop-*-matched-r6-medium-*.jsonl`

## Interpretation and next gate

These repaired blocks show that all three provider strata can complete this
short evolution task and the medium search-to-detail task under the current
profiles. They do not establish a universal arm winner: the blocks contain one
evolution repetition and one medium repetition, while the fault block still
contains the Qwen Pure Visual failure observed in repetition 4. The next
required step is another reset-isolated repetition, including the complex
search-back-reopen task, before estimating variance or starting confirmatory
collection.
