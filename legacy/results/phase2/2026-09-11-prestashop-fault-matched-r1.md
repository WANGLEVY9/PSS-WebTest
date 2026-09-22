# PrestaShop functional-fault matched pilot — repetition 1

Date: 2026-09-11  
Status: pilot/diagnostic only; not an admitted application and not confirmatory evidence.

## Scope

This block uses the authenticated local PrestaShop SUT after a clean reset. The isolated mutation `search-result-label-omission` changes the visible name of the database-backed product `Pack Mug + Framed poster` to `Framed Poster` in the search result while leaving the database unchanged. The independent oracle checks both the expected database row and the visible fault condition. The three agent providers were run with the same task, condition, viewport, reset protocol, and fault verdict contract; Playwright was repeated once for each provider stratum so the ledger has complete matched accounting.

The task-definition mismatch found in the first attempt was fixed before this block: the runner now takes `PSS_PRESTASHOP_EXPECTED_PRODUCT` and uses the mutation's actual source name. The earlier mismatch is excluded from this ledger.

## Matched ledger result

| Provider/model stratum | Pure visual CUA | Hybrid visual+structure | Playwright baseline |
|---|---:|---:|---:|
| Alibaba / qwen3.7-flash | failed: `grounding-loop` | failed: `grounding-loop` | completed, fault verdict, independent oracle passed |
| DeepSeek / deepseek-v4-flash-vision-exp | failed: `grounding-loop` | failed: `grounding-loop` | completed, fault verdict, independent oracle passed |
| Volcengine / doubao-seed-2-1-pro-260628 | failed: `provider-format` | failed: `provider-format` | completed, fault verdict, independent oracle passed |

Ledger audit: 9 records, 9 unique run IDs, 3 records per arm, no missing or duplicate records. The three Playwright repetitions are the same deterministic script under the three provider strata; provider fields remain null for the scripted arm.

## Evidence boundary

All nine records have `ground_truth_verdict=fault` and `independent_oracle_passed=true`. Playwright reached the search-results milestone with the expected product absent and the replacement visible, and emitted the required `fault` verdict. The visual and hybrid agents did not reach the search-results milestone in this block: Qwen and DeepSeek stopped at a repeated non-progressing click on the authenticated home page; Doubao stopped at an invalid JSON response before taking an action. Therefore these are observed failure boundaries, not claims that the models can never detect this fault.

This pilot identifies two actionable strata for later debugging—grounding/navigation and provider-format conformance—but does not support a universal ranking or any confirmatory claim. The next admissible step is to reproduce the block after any explicitly registered agent/provider fix, retain the old block unchanged, and only then use pilot variance to set repetition counts.

## Artifact

- Ledger: `artifacts/phase2/run-records/2026-09-11-prestashop-fault-r1.jsonl` (local, ignored)
- Runner changes: `code/scripts/run-prestashop-agent-cell.mjs`, `code/scripts/run-prestashop-playwright-cell.mjs`
- Mutation catalog: `code/src/prestashop-mutations.mjs`
