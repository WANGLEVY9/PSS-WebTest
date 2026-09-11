# PrestaShop behavior-preserving UI-evolution matched pilot

Date: 2026-09-11  
Evidence boundary: one exploratory evolution repetition per provider; not an admission or confirmatory result.

## Condition gate

The live apply-remove-isolation gate passed for
`search-layout-preserving-v1`: the style-only mutation applied, was removed,
did not change the visible target or product count, and an isolated context was
clean. The independent database rows were unchanged before and after the gate.

The mutation was then installed in each browser context after the search-results
milestone. Agent and Playwright runners used the same task ID,
`prestashop-buyer-search-product`, and the records persisted
`independent_oracle_passed` in the standard ledger.

## Observed records

| Provider/model | Pure visual | Hybrid | Playwright | Independent oracle |
|---|---|---|---|---|
| Qwen3.7-Flash | failed: `grounding-loop` | completed | completed | 3/3 true |
| DeepSeek V4 vision | failed: `grounding-loop` | completed | completed | 3/3 true |
| Doubao Seed 2.1 | failed: `provider-format` | failed: `provider-format` | completed | 3/3 true |

The ledger audit returned `status: ok`, 9 unique run IDs, and no missing-arm
or duplicate-ID errors. The local ignored ledgers are:

- `artifacts/phase2/run-records/2026-09-11-qwen-prestashop-evolution-r1-aligned.jsonl`
- `artifacts/phase2/run-records/2026-09-11-deepseek-prestashop-evolution-r1-aligned.jsonl`
- `artifacts/phase2/run-records/2026-09-11-doubao21-prestashop-evolution-r1-aligned.jsonl`

## Interpretation

For this one behavior-preserving style mutation, the observed failure pattern
was similar to the clean pilot: structural Hybrid succeeded for Qwen and
DeepSeek, Playwright succeeded for all three provider-labelled blocks, and
pure visual did not complete. This is a diagnostic interaction with one
evolution condition, not evidence that one strategy is globally superior.
The result must remain separated by provider/model, framework, task, and
condition.

## Next gate

The functional fault mutation still requires a task whose declared expected
outcome is fault detection. It must not be run through the current clean-search
intent and then interpreted as a clean failure. After that fault task is
implemented and oracle-linked, collect matched fault repetitions, then combine
clean/evolution/fault pilot strata for variance and power simulation.
