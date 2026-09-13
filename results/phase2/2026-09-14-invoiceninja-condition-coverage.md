# Invoice Ninja strict condition coverage (2026-09-14)

The strict provider-format path was extended beyond clean-stable to functional-fault and UI-evolution. Each condition used three independent reset-complete repetitions and the same three arms.

| Condition | Playwright | Pure visual | Hybrid | Main visual boundary |
|---|---:|---:|---:|---|
| Clean stable | 3/3 | 0/3 | 3/3 | provider-format |
| Functional fault | 3/3 | 0/3 | 3/3 | provider-format |
| UI evolution | 3/3 | 1/3 | 3/3 | provider-format (2), grounding-loop (1) |

All 18 condition-run independent database-oracle checks passed. The strict visual failures therefore remain provider/agent protocol failures rather than SUT reset or oracle failures. The evolution condition shows one non-format grounding-loop in addition to two provider-format boundaries.

The reset-complete, execution-variant-aware input now contains 866 valid records, 210 cells, 78 matched blocks, and 62 eligible planning blocks. Invoice Ninja contributes four eligible Qwen blocks: clean strict, clean bounded-repair ablation, functional-fault strict, and UI-evolution strict. These are still pilot/diagnostic inputs; application admission remains blocked by workflow breadth and image/license provenance.

Artifacts:

- [controller report](2026-09-13-invoiceninja-matched-pilot-strict-condition-r3.md)
- [reset-complete input](2026-09-14-reset-complete-pilot-input-after-invoice-conditions-v1.json)
- [power sensitivity](2026-09-14-reset-complete-power-after-invoice-conditions-v1.json)
