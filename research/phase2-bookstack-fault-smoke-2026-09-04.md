# BookStack create-page fault-control smoke — 2026-09-04

## Scope and non-claim

This is an execution/oracle control for the new `bookstack-create-page` v0.2
path. It is **not** a matched three-arm experiment, contains no agent/provider
call, does not enter the Phase 2 evidence table, and contributes zero to the
empirical-study denominator.

The SUT was the disposable local BookStack fixture. Each control used the
same seeded-state reset digest:
`6246d6dbf78bf96557b59bdae5d4293ebf1236e6d61868139ee30ced0424257a`.

## Controls

| Control | Script-visible verdict | Independent persisted-state verdict | Joint cell result | Interpretation |
|---|---|---|---|---|
| clean state | `clean` | `clean` (`candidate=1`, `clean_matches=1`, `fault_matches=0`) | pass | The ordinary scripted assertion and DB oracle agree on a correct save. |
| `persistence-mismatch` trigger | `fault` | `fault` (`candidate=1`, `clean_matches=0`, `fault_matches=1`) | pass | The script detects a visible mismatch without DB input; the oracle independently observes the declared corrupt persisted state. |

For the fault control, the script completed in 3,348 ms with 10 explicit UI
actions. For the clean control, it completed in 2,730 ms with 10 actions.
These timings are smoke diagnostics only, not comparative measurements.

## Isolation and cleanup

The trigger `pss_corrupt_page_content` was removed after the fault control.
The final reset restored `users=2`, `books=3`, and `pages=6`; the final oracle
observed no candidate test page (`candidate=0`, `clean_matches=0`,
`fault_matches=0`). Thus no test page or fault trigger was retained.

## Admission consequence

The fault-aware oracle and scripted verdict path are eligible for a **new**
matched pilot. The visual and hybrid configurations have not yet been run on
this workflow or fault condition. Therefore no fault sensitivity, specificity,
or cross-arm conclusion is available.
