# Invoice Ninja bounded-JSON-repair ablation (2026-09-14)

## Design

This is a diagnostic engineering ablation, not a replacement for the strict provider protocol. The only change was the explicit `CUA_ALLOW_BOUNDED_JSON_REPAIR=1` flag. The parser accepts a complete JSON object wrapped in fenced/textual output, but still rejects truncated or semantically invalid arguments. The run is labelled `pss-native:bounded-json-repair` and is not pooled with strict provider-format records.

## Results

| Arm | Repetitions | Strict passes | Independent oracle |
|---|---:|---:|---:|
| Playwright | 3 | 3 | 3/3 |
| Pure visual | 3 | 3 | 3/3 |
| Hybrid | 3 | 3 | 3/3 |

The earlier strict block had pure visual **0/3** with `provider-format` failures while the independent oracle passed. Under the bounded repair ablation, visual became **3/3**. This strongly supports an engineering/protocol-boundary contribution to that failure boundary for this provider/task; it is not evidence that the model is universally reliable or that CUA dominates scripted testing.

The reset-complete, variant-aware input now has 848 valid records, 204 cells, 76 matched blocks, and 60 eligible planning blocks. Invoice Ninja contributes two separate eligible Qwen blocks: one strict-provider-format block and one bounded-json-repair block. The application itself remains not admitted because workflow breadth and image/license gates are unresolved.

Artifacts:

- [controller report](2026-09-13-invoiceninja-matched-pilot-bounded-json-repair-ablation-r3.md)
- [variant-aware reset-complete input](2026-09-14-reset-complete-pilot-input-after-json-repair-r3.json)
- [variant-aware power sensitivity](2026-09-14-reset-complete-power-after-json-repair-r3.json)
