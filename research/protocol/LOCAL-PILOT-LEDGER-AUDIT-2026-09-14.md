# Local pilot ledger audit — 2026-09-14

This is a diagnostic inventory of the existing local SUT ledgers. It is not a
confirmatory estimate and is excluded from the redesigned benchmark denominator
by `study-design-contract.v1.0.json`.

## Deduplicated inventory

Generated with `npm run report:phase2:pilot-input -- --output /tmp/pss-pilot-input.json --minimum-repetitions 3`:

| Quantity | Value |
|---|---:|
| Valid run records | 4,366 |
| Invalid records retained for audit | 158 |
| Cells | 326 |
| Cells with ≥3 repetitions and complete reset evidence | 144 |
| Three-arm matched blocks meeting that engineering criterion | 51 |
| Applications represented | 5 |

The cell key preserves application, workflow, condition family, arm,
provider/model, and execution variant. Provider/model strata are not pooled.

## Arm inventory (pilot only)

| Arm | Cells | Records | Strict passes |
|---|---:|---:|---:|
| Playwright | 51 | 1,057 | 968 |
| Pure visual | 133 | 1,587 | 645 |
| Hybrid | 142 | 1,722 | 1,099 |

The strict-pass counts are descriptive ledger fields, not general success-rate
claims. The local applications and task distribution were not selected by the
new outcome-blind official benchmark protocol, and the records mix historical
engineering campaigns with current pilots.

## Interpretation and next gate

These records are sufficient to exercise variance/reporting code and to inspect
failure boundaries. They do not satisfy G1 (benchmark environment/evaluator
gates), G2 (dual outcome-blind task screening), G4 (Traditional adaptation), or
G5 (held-out protocol pilot). Repetition counts and power remain unfrozen, and
confirmatory collection remains unauthorized.

