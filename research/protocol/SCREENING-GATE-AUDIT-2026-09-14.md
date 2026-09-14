# Outcome-blind screening gate audit — 2026-09-14

## Scope

This audit covers the frozen source inventory for the confirmatory core:
WebArena-Verified, VisualWebArena, and ATA/PinATA. It is a protocol artifact,
not an experiment result. No arm was executed and no task was admitted.

## Current evidence

| Item | Count/status |
|---|---:|
| Source candidates | 1,834 |
| WebArena-Verified candidates | 812 |
| VisualWebArena candidates | 910 |
| ATA/PinATA candidates | 112 |
| Screening criteria | IC1–IC7 (7 per candidate) |
| Blank screening rows | 12,838 |
| Task-characteristic annotation rows | 1,834 |
| Dual reviews/adjudications completed | 0 |
| Confirmatory authorization | false |

The inventory and blank template were regenerated from the locally pinned
source commits. The screening CLI reports `screening-pending` and exits with
code 2, as required by the fail-closed gate.

## Identity and integrity check

VisualWebArena reuses numeric task IDs across its three site-scoped source
files. The ledger therefore binds each candidate to its benchmark, source
commit, task ID, and 64-character instruction digest. A source-file-only or
numeric-ID-only key would merge distinct tasks and is prohibited.

## Required next actions

1. Two independent reviewers complete IC1–IC7 without seeing any arm outcome,
   evaluator internals, or pilot failures.
2. Two independent annotators code the frozen task-characteristic fields and
   record agreement statistics.
3. An adjudicator resolves disagreements and freezes included/excluded task
   tables and their manifest digest.
4. Only after those artifacts and the benchmark environment/reset/evaluator
   gates pass may Traditional adaptation and the held-out protocol pilot begin.

