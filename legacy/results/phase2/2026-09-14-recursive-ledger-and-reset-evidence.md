# Phase 2 recursive ledger and reset-evidence tranche (2026-09-14)

## Scope

This tranche hardens the pilot evidence path; it does not authorize confirmatory collection. The controller now propagates the WebTestPilot seeded-state digest to every PrestaShop arm record, and the audit/pilot-input/summary readers recursively include migrated `artifacts/phase2/run-records` ledgers while excluding duplicate `run_id` copies.

## Engineering evidence

- Contract suite: **219/219 passed**.
- PrestaShop authenticated medium-workflow sentinel: **3/3 strict pilot cells passed** (Playwright, pure visual, hybrid) after independent reset-before-each-arm.
- All three sentinel records carry the same reset digest: `8c09937d81071dfa93440c5c1d0bc05d7180ba2b3cb5e748fa9de4500a3f0ad6` and `prestashop-seeded-state-digest-v1`.
- The digest is reset evidence only. These records remain schema `0.1`; they are not silently promoted to the full v0.2 provenance contract.

## Recomputed pilot input

The recursive, de-duplicated reader scanned 532 JSONL files, excluded 140 duplicate `run_id` copies, and retained 4,264 valid records plus 158 invalid records. It produced 322 descriptive cells, 141 single-arm repetition-eligible cells, 115 matched three-arm blocks, and 51 matched blocks eligible for planning input.

| Application | Valid records | Eligible cells | Strict passes | Admission status |
|---|---:|---:|---:|---|
| BookStack | 383 | 7 | 260 | blocked: workflow breadth, oracle, fault/evolution |
| Indico | 135 | 15 | 40 | blocked: workflow breadth, oracle |
| OWASP Juice Shop | 534 | 119 | 280 | pilot-admission candidate; not confirmatory |
| Invoice Ninja | 249 | 0 | 176 | blocked: workflow breadth, image/license |
| PrestaShop | 2,963 | 0 | 1,872 | blocked: workflow breadth, image/license and live strata coverage |

The PrestaShop sentinel improves reset observability but does not make the application eligible: one new repetition cannot satisfy the minimum three-repetition cell rule, and the application still has only three of eight declared workflow slots.

## Power-planning boundary

The matched-block planner was rerun with 1,000 deterministic Monte Carlo draws. It still has 26 Qwen-stratum and 25 DeepSeek-stratum eligible blocks. The resulting sensitivity grid remains planning-only; it does not freeze 14 repetitions or any alternative count. Provider/model strata remain separate, and the current pilot rates are not final effect estimates.

## Next long batch

1. Migrate the three real PrestaShop workflows and the two Invoice Ninja workflows to the same reset-evidence-aware ledger path; do not add candidate slots until task adapters and independent oracles are executable.
2. Complete recursive ledger migration for any remaining controller-only summaries, with `run_id` de-duplication retained as an audit signal.
3. Repair the remaining application gates (workflow breadth, image/license provenance, and Indico create-event oracle), then rerun the admission audit.
4. Only after complete matched blocks are available across the pre-registered strata should the analysis script freeze repetition count and power; confirmatory collection remains blocked.

Artifacts:

- [pilot input JSON](2026-09-14-phase2-pilot-input-recursive-v1.json)
- [ledger summary JSON](2026-09-14-phase2-ledger-summary-recursive-v1.json)
- [admission audit JSON](2026-09-14-phase2-application-admission-audit-recursive-v1.json)
- [matched power-planning JSON](2026-09-14-phase2-matched-power-recursive-v1.json)
