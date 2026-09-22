# PrestaShop reset-complete fresh block (2026-09-14)

## What was run

One Qwen 3.7 Flash provider stratum was executed with three independent repetitions, three arms, medium search/open-product workflow, and reset-before-each-arm. The controller randomized arm order within each repetition and propagated the same post-reset digest to the child ledger record for each arm.

## Observed pilot evidence

| Arm | Repetitions | Strict passes | Reset digest coverage |
|---|---:|---:|---:|
| Playwright | 3 | 3 | 3/3 |
| Pure visual | 3 | 3 | 3/3 |
| Hybrid | 3 | 3 | 3/3 |

The fresh block therefore forms **one reset-complete matched block** for planning. It is not an application admission result: PrestaShop still has only 3/8 workflow slots in the admission manifest, its image/license gate is unresolved, and the wider historical ledger contains records without reset digest that are not retroactively repaired.

## Scope-control check

The default recursive pilot input still retains all historical records and reports 4,264 valid records, 158 invalid records, 115 matched blocks, and 51 eligible planning blocks. A separate `--reset-complete-only` input excludes every record without an explicit reset digest. In that fresh/reset-complete view there are 827 valid records, 197 cells, 72 matched blocks, and 58 eligible planning blocks; the PrestaShop contribution is exactly 3 cells and one eligible Qwen matched block.

The filter is explicit and machine-recorded. It is not used to inflate the default audit and does not authorize confirmatory collection.

## Next actions

1. Repeat this reset-complete migration for an additional PrestaShop condition only after its mutation apply/remove/isolation gate is rerun.
2. Add the remaining real PrestaShop workflow adapters and image/license evidence before any application-level admission claim.
3. Migrate Invoice Ninja to the same reset-evidence-aware ledger path.
4. Keep the power output as sensitivity planning only; repetition count remains unfrozen.

Artifacts:

- [reset-complete pilot input](2026-09-14-prestashop-reset-complete-pilot-input-v1.json)
- [reset-complete power sensitivity](2026-09-14-prestashop-reset-complete-power-planning-v1.json)
- [recursive ledger audit](2026-09-14-phase2-application-admission-audit-recursive-v1.json)
