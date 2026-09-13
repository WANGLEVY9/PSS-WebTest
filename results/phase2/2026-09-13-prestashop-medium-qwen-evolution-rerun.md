# PrestaShop medium UI-evolution matched rerun

Date: 2026-09-13

Status: pilot/admission evidence; not confirmatory.

## Cell definition

One independent reset was allocated to each arm for the same medium workflow
(`prestashop-search-open-product`) under the behavior-preserving
`search-layout-preserving-v1` condition. The mutation changes only the result
card layout; the business intent, expected product, and independent database
oracle remain fixed.

## Engineering repair and A/B evidence

The first block exposed a Playwright runner timeout after the product click.
The screenshot/replay showed the search result was present and the style-only
mutation was active, while the runner had not emitted a product-detail
checkpoint. The failure was classified as a locator/navigation contract issue,
not as a CUA or SUT failure. The runner was repaired to click the product's
actual anchor, wait for the `.html` route transition, and then validate the
visible detail heading. The original failed block is retained as diagnostic
evidence and is not replaced by this rerun.

## Corrected matched block

| Arm | Strict pass | Protocol-complete | Independent oracle |
|---|---:|---:|---:|
| Pure visual | 1/1 | 1/1 | 1/1 |
| Hybrid | 1/1 | 1/1 | 1/1 |
| Playwright | 1/1 | 1/1 | 1/1 |

The ledger audit reports three records, three unique run IDs, one consistent
cell, and no duplicate or malformed records. This is a positive conditional
pilot result for this task × condition × Qwen stratum; it does not admit
PrestaShop or freeze repetition counts.

Artifact:
`code/artifacts/phase2/2026-09-13-aliyun-qwen3.7-flash-prestashop-ui-evolution-search-layout-preserving-v1-canary-phase2-t1-prestashop-medium-qwen-evolution-rerun-20260913-pilot.json`.

Ledger:
`code/artifacts/phase2/run-records/2026-09-13-aliyun-qwen3.7-flash-prestashop-ui-evolution-search-layout-preserving-v1-canary-phase2-t1-prestashop-medium-qwen-evolution-rerun-20260913-aligned.jsonl`.

Variance output is planning-only because this stratum has one repetition per
arm.
