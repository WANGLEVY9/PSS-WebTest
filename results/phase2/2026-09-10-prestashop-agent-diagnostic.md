# PrestaShop CUA/Hybrid provider diagnostic (2026-09-10)

This is provider/grounding diagnostic evidence after the PrestaShop platform and fault/evolution isolation gates. It is not a matched three-arm pilot, an admission result, or confirmatory evidence.

## Common controls

- Native reset immediately preceded the runs; the application was reachable and seeded.
- The independent database oracle passed in every run: `Mug The adventure begins` was present in `ps_product_lang`.
- Authentication was a common scripted preamble and credentials were never included in provider observations.
- Run-records and replay manifests are stored locally under ignored `artifacts/phase2/`.

## Runs

| Run | Arm/configuration | Actions | Outcome | Boundary observed |
|---|---|---:|---|---|
| `prestashop-visual-search-r1` | Pure visual, Qwen JSON action mode | 6 clicks | fail / timeout | six clicks clustered at the upper-right search area; screenshot digest did not change; `agent-step-budget` |
| `prestashop-visual-search-r2-tool` | Pure visual, Qwen tool-call mode | 6 actions | fail / timeout | click, type, Enter, then waits; click was outside the input hitbox, so the page stayed on `/`; `agent-step-budget` |
| `prestashop-visual-search-r3-pixels` | Pure visual, Qwen tool-call + pixel coordinates | 6 actions | fail / timeout | click at `(829,125)` missed the search input; type/Enter had no effect; `agent-step-budget` |
| `prestashop-hybrid-search-r1` | Hybrid, coordinate mode | 2 attempted actions | fail | repeated non-progressing coordinate click; `grounding-loop` |
| `prestashop-hybrid-search-r2-semantic` | Hybrid, semantic target-id mode | 3 | pass | `c9` search textbox, type `Mug`, Enter; search results and oracle both passed |

## Interpretation

The controls rule out reset failure, database-oracle failure, and authentication failure for this task. The evidence instead separates two agent-side boundaries:

1. Pure visual Qwen responses are not yet reliable for pixel grounding on this 1280×720 page. The model either repeats a near-input click or selects a coordinate outside the input hitbox; this is not a provider timeout.
2. Hybrid structure is useful when the semantic target-id action mode is enabled. The coordinate mode still inherits the visual grounding error, while semantic mode completed the same intent with three actions.

The successful semantic run is a diagnostic single repetition only. It does not freeze repetitions or admit PrestaShop, because the three arms and all declared conditions still need matched replication.
