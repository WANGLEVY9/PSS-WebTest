# Phase 2 live evidence ledger — 2026-08-18

This is a feasibility/pilot ledger, not confirmatory effect estimates.

## Indico fault workflow

`npm run pilot:indico:fault` completed successfully after isolating prior fixture rows:

```json
{
  "trigger_applied": true,
  "browser_fault_visible": true,
  "independent_oracle_detected_fault": true,
  "trigger_removed": true,
  "passed": true
}
```

The browser observed the trigger-induced title suffix `[FAULT]`; the fault-aware PostgreSQL evaluator independently found exactly one matching fault row; the trigger was removed in `finally`.

## Real provider pilot records

The local run-record ledger was validated with `npm run records:collect` and contains three records (two visual, one hybrid). All three are non-completions under the independent visible-UI oracle:

| arm | condition | status | checkpoint | observation contract | interpretation |
|---|---|---:|---:|---|---|
| hybrid | clean-stable | timeout | false | screenshot-plus-structure | provider returned/attempted Enter, but page stayed on `#/` |
| visual | clean-stable | timeout | false | screenshot-only | provider did not reach the search postcondition |
| visual | clean-stable | test-failure | false | screenshot-only | bounded pilot did not satisfy the UI oracle |

The provider/model identity is stored only in the sanitized provenance field of each run record; API keys, credentials, screenshots, and raw observations are not committed.

## Gate interpretation

- Indico fault/evaluator gate: passed.
- Real hybrid SUT invocation: passed as an invocation/contract smoke, but task completion: not passed.
- Standard run-record schema, append-only JSONL collection, and validation: passed for the three records.
- Pure-visual full multi-step reliability: not passed.
- No three-arm matched confirmatory outcome or power claim is made from these records.

## BookStack three-arm matched pilot attempt

The unified runner executed 9 planned cells (3 repetitions × `playwright`, `visual`, `hybrid`) with the same task intent, reset command, oracle, and agent budget. The artifact is `artifacts/phase2/bookstack-three-arm-pilot.json` (gitignored). Only 1 cell passed; several cells were excluded because the reset gate failed, and agent cells with a clean reset did not reach the persisted-state oracle. Therefore this is an infrastructure/feasibility pilot, not an admitted matched pilot.

The planning simulation (`npm run power:simulate`) excludes rows with `reset_ok=false` and applies Jeffreys smoothing. With the remaining tiny samples, estimated power reaches approximately 0.72 for Playwright-vs-visual at 24 repetitions per arm and only 0.47 for Playwright-vs-hybrid; these numbers are provisional and explicitly do not freeze confirmatory repetition counts.
