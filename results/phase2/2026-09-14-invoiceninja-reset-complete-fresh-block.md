# Invoice Ninja reset-complete fresh block (2026-09-14)

## Design

Three independent repetitions of the `view-invoice-details` workflow were run for one live Qwen 3.7 Flash stratum. Each repetition began with a fresh Invoice Ninja reset, deterministic seeded counts, and randomized order of Playwright, pure visual, and hybrid arms. The controller now carries the same reset digest and randomization block into every child record.

## Results (pilot/diagnostic only)

| Arm | Repetitions | Strict passes | Boundary |
|---|---:|---:|---|
| Playwright | 3 | 3 | none |
| Pure visual | 3 | 0 | provider-format (three runs) |
| Hybrid | 3 | 3 | none |

The independent database oracle passed for all nine runs, but the visual arm did not complete the protocol because the provider-format boundary prevented a valid termination. This is evidence about this provider/runner path, not a claim that all pure-visual CUA systems are incapable of the task.

The three-arm fresh block is reset-complete and therefore contributes one eligible Qwen matched planning block. It does not admit Invoice Ninja: the application still has only 2/8 workflow slots in the admission manifest, and the image/license gate remains unresolved.

## Updated reset-complete view

With `--reset-complete-only`, the combined explicit-reset tranche contains 836 valid records, 200 cells, 73 matched blocks, and 59 eligible planning blocks. Invoice Ninja contributes exactly one eligible block; PrestaShop contributes one. The default all-history audit remains unchanged and remains the authority for application admission.

Artifacts:

- [controller report](2026-09-13-invoiceninja-matched-pilot-reset-digest-v1-fresh-qwen-r3.md)
- [reset-complete pilot input](2026-09-14-reset-complete-pilot-input-after-invoice-v1.json)
- [reset-complete power sensitivity](2026-09-14-reset-complete-power-after-invoice-v1.json)
