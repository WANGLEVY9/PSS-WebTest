# PrestaShop medium clean matched pilot — DeepSeek V4.1-Flash

Date: 2026-09-13

Status: pilot/admission evidence; not confirmatory.

## Adapter repair

The initial DeepSeek provider gate failed only for pure visual because the
provider emitted a direct function name `type` instead of the declared
`ui_action` wrapper. Hybrid already produced the required sequence. The
adapter now accepts only the bounded common action names as aliases and routes
their arguments through the same strict action validator; arbitrary tool names
remain rejected. The targeted readiness gate then passed for both visual and
hybrid.

## Matched result

One independent reset per arm on the repaired PrestaShop medium
search/open-product workflow produced:

| Arm | Strict pass | Protocol-complete | Independent oracle |
|---|---:|---:|---:|
| Pure visual | 1/1 | 1/1 | 1/1 |
| Hybrid | 1/1 | 1/1 | 1/1 |
| Playwright | 1/1 | 1/1 | 1/1 |

The ledger audit reports three unique records, one consistent cell, and no
errors. DeepSeek is therefore a valid conditional model-stratum pilot for this
workflow. It does not admit PrestaShop, pool with Qwen, or freeze repetitions;
fault/evolution and the remaining workflow slots remain open.

Artifact:
`code/artifacts/phase2/2026-09-13-deepseek-deepseek-v4-flash-vision-exp-prestashop-clean-stable-canary-phase2-t1-prestashop-medium-deepseek-clean-repair-rerun-20260913-pilot.json`.
