# Execution-variant stratification tranche (2026-09-14)

The pilot input and matched power planner now include an explicit execution variant. Strict provider-format runs, bounded JSON-repair runs, and framework adapters are no longer silently pooled under only provider/model labels. Playwright remains the scripted anchor for each matched variant, while the agent variant is carried in the block and power stratum.

## Recomputed evidence

- Contract suite: **221/221 passed**.
- Default recursive input: 4,285 valid records, 158 invalid records, 326 cells, 118 matched blocks, 51 eligible planning blocks.
- Reset-complete-only input: 839 valid records, 204 cells, 76 matched blocks, 59 eligible planning blocks.
- Invoice Ninja now appears as two separate fresh variants:
  - `pss-native:strict-provider-format`: one eligible Qwen matched block (the 3-repetition block with pure visual 0/3 provider-format failures).
  - `pss-native:bounded-json-repair`: an exploratory 1-repetition diagnostic is present but not eligible and is not pooled with strict runs.

The bounded repair flag is opt-in and remains a diagnostic ablation. It extracts only a complete JSON object from fenced output; it does not repair truncated JSON or infer missing fields. The default strict path is unchanged.

Artifacts:

- [variant-aware pilot input](2026-09-14-phase2-pilot-input-variant-aware-v1.json)
- [variant-aware power sensitivity](2026-09-14-phase2-matched-power-variant-aware-v1.json)
- [reset-complete variant input](2026-09-14-reset-complete-pilot-input-variant-aware-v1.json)
- [reset-complete variant power sensitivity](2026-09-14-reset-complete-power-variant-aware-v1.json)
