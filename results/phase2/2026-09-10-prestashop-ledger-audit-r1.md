# PrestaShop diagnostic ledger audit (2026-09-10)

The three arm ledgers were audited together after the parallel runs.

| Item | Value |
|---|---:|
| Unique run records | 16 |
| Duplicate run IDs | 0 |
| Visual records | 3 (0 completed, 3 failures) |
| Hybrid records | 6 (5 completed, 1 failure) |
| Playwright records | 7 (6 completed, 1 failure) |
| Cell-level audit | pass |
| Matched repetition admission | closed |

The audit passes because all three arms are represented and every run has a unique ID. It does not pass the matched admission gate: the repetition counts are intentionally unequal, the visual arm has no successful clean run, and the Hybrid successes use semantic target-id mode while the failed run uses coordinate mode. These protocol strata remain separate until a preregistered matched configuration is frozen.
