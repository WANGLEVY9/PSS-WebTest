# PrestaShop medium search/open-product matched rerun

Date: 2026-09-13

Status: pilot/admission evidence; not confirmatory.

## Alignment repair

The first medium-complexity attempt produced six successful-looking executions,
but the ledger audit split them into two task cells: the Playwright runner
hard-coded the simple task id and only searched, while the agent runner used the
medium task id and opened the product. Those six records are retained as
`invalid-ledger` infrastructure evidence and are excluded from this result.
They remain available in the prior artifact and aligned ledger tagged
`phase2-t1-prestashop-medium-qwen-rep2-20260913`.

The Playwright runner was repaired to share the complexity-to-task mapping with
the agent runner and to execute the full medium workflow: authenticate, search,
open the expected product detail page, and verify the visible detail heading.
The complex branch now additionally returns to the result list and reopens the
product. A regression contract test protects this mapping.

## Corrected matched block

Two independent repetitions were run with Qwen3.7-VL Flash under
clean-stable. Each cell reset PrestaShop independently and used the same
medium task, independent database product oracle, and replay/run-record
contract.

| Arm | Strict pass | Protocol-complete | Independent oracle |
|---|---:|---:|---:|
| Pure visual | 2/2 | 2/2 | 2/2 |
| Hybrid | 2/2 | 2/2 | 2/2 |
| Playwright | 2/2 | 2/2 | 2/2 |

The corrected ledger audit reports six records, six unique run IDs, one
consistent cell (`prestashop-search-open-product/clean-stable`), and no errors.

Artifact:
`code/artifacts/phase2/2026-09-13-aliyun-qwen3.7-flash-prestashop-clean-stable-canary-phase2-t1-prestashop-medium-qwen-rep2-rerun-20260913-pilot.json`.

This is a positive task-family × provider pilot stratum, not evidence that any
arm is universally better. It should be kept separate from the earlier invalid
ledger and from simple/complex PrestaShop strata until the fault/evolution
controls and complete application admission subset are complete.
