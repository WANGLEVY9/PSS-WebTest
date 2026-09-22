# Legacy archive

This directory holds **historical evidence and superseded configurations** that are
preserved for traceability but are **outside the current execution scope**.

Current scope is WAV-only. See `docs/WAV-ONLY-EXECUTION-SCOPE.md` and `docs/RESEARCH.md`:
the five local applications (PrestaShop, BookStack, Indico, Invoice Ninja, OWASP Juice Shop)
and the phase2 pilot campaign are **not** part of the current core study.

## Contents

| Path | What it is | Status |
| --- | --- | --- |
| `legacy/results/phase2/` | 204 dated pilot reports (2026-08/09) from the five local applications | Historical; not manuscript evidence for the current protocol |
| `legacy/artifacts/phase2/` | 111 raw pilot artifacts (replays, dashboards, ledgers) produced by those runs | Historical; moved out of the ignored `artifacts/` path so it is properly tracked |
| `code/config/archive/` | 45 superseded configuration documents (retired design contracts v1.0/v2.0, metric dictionary v0.1, long-cycle plan, phase2 scaling/expansion/tranche plans, local-application run manifests, provider/benchmark matrices) | Superseded; active configurations stay directly under `code/config/` |

## Reading rules

1. **Nothing here is current evidence.** No number in `legacy/` may fill a manuscript
   table cell of the active protocol (`pss-manuscript-v2.1`). See
   `research/PAPER-RESULTS-REPORTING.md` and the `pss-paper-reporting` skill.
2. **Path references in dated receipts may be stale.** Verification reports under
   `code/artifacts/local-runtime/**` and `docs/verification/*.json` list source paths as
   they were on the day they were produced. Content hashes are unchanged; only the
   locations were reorganised on 2026-09-22. Files relocated in that restructure:
   - `code/local-lab/*.md` → `code/docs/runbooks/` (maintained) and `code/docs/status/` (dated)
   - `code/local-lab/server.mjs` + `code/local-lab/public/` → `code/console/`
   - `code/local-lab/*.test.mjs` → `code/tests/local-lab/`
   - `results/phase2/`, `artifacts/phase2/` → `legacy/`
   - superseded `code/config/*.json` → `code/config/archive/`
3. **Code that consumes the legacy pilots still exists** in `code/src/`, `code/scripts/`
   and `code/dashboard/`. Its default output paths now point into `legacy/`, so rerunning
   a legacy script writes to the archive, not to a live results directory.

## Why archived instead of deleted

`docs/WAV-ONLY-EXECUTION-SCOPE.md` requires preserving all historical source, contracts
and evidence. Archiving keeps the record reproducible while removing these materials from
the working structure.
