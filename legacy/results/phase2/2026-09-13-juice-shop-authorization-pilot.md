# Juice Shop anonymous authorization pilot (2026-09-13)

Status: diagnostic pilot only; no application admission, variance freeze, or
confirmatory inference.

## Design and engineering validity

The real Juice Shop v20 SUT exposes an anonymous `/#/administration` route with
a visible `403` and the exact denial message `You are not allowed to access
this page!`. No account credentials are required. The matched agent runners
open this route before exposing the observation; this is necessary because the
current action schema has no arbitrary URL-navigation action.

The functional-fault condition uses a browser-scoped mutation that removes only
the denial card. It never changes server permissions or persisted data. The
independent oracle checks the route and denial semantics and never consumes the
agent verdict. A readiness bug discovered in the first fault block (the runner
waited for a `mat-card` that the fault intentionally removed) was fixed by
using an attached body/root boundary for this task. The affected Qwen and
DeepSeek `fault-r1` blocks are excluded; replacement blocks are the only data
reported below.

## Matched results

| Provider/model | Condition | Pure visual | Hybrid | Playwright | Strict block |
|---|---|---:|---:|---:|---:|
| Alibaba / Qwen3.7-Flash | clean-stable | 1/1 | 1/1 | 1/1 | 3/3 |
| Alibaba / Qwen3.7-Flash | functional-fault | 0/1 (oracle-only, step-budget) | 1/1 | 1/1 | 2/3 |
| Alibaba / Qwen3.7-Flash | ui-evolution | 1/1 | 1/1 | 1/1 | 3/3 |
| DeepSeek / V4.1-Flash | clean-stable | 1/1 | 1/1 | 1/1 | 3/3 |
| DeepSeek / V4.1-Flash | functional-fault | 1/1 | 1/1 | 1/1 | 3/3 |
| DeepSeek / V4.1-Flash | ui-evolution | 1/1 | 1/1 | 1/1 | 3/3 |

Across 18 valid reset-verified executions:

- Playwright: 6/6 strict;
- Hybrid: 6/6 strict;
- Pure visual: 5/6 strict;
- Qwen agent strata: visual 2/3, Hybrid 3/3;
- DeepSeek agent strata: visual 3/3, Hybrid 3/3.

The single Qwen visual fault result reached the independent fault oracle but
did not emit the required `fault` verdict before the step budget. It remains a
strict failure and is not upgraded because the oracle was correct.

## Interpretation boundary

This task isolates anonymous authorization semantics rather than login
credentials. The clean/evolution results show that both agent arms can inspect
and classify a visible access-control denial in this SUT. The Qwen visual fault
case indicates a termination-budget boundary, while the DeepSeek fault result
shows that the same protocol is executable under another model stratum. These
observations are task- and model-conditional pilot evidence, not a universal
CUA or Hybrid success rate.

## Reproducibility artifacts

Tracked implementation:

- `code/src/mutations/juice-shop.mjs`
- `code/src/oracles/juice-shop-authorization.mjs`
- `code/scripts/evaluate-juice-shop-authorization.mjs`
- `code/tests/traditional/juice-shop-authorization.spec.js`
- `code/config/juice-shop-authorization-run-manifest.v0.1.json`
- `code/scripts/juice-shop-matched-pilot.mjs`
- `results/phase2/2026-09-13-juice-shop-authorization-metrics-summary.json`

Raw replay and JSONL files remain local under `artifacts/phase2/` and are
ignored. The valid controller summaries are tagged:

- `authorization-qwen-clean-r2`
- `authorization-qwen-fault-r3`
- `authorization-qwen-evolution-r1`
- `authorization-deepseek-clean-r1`
- `authorization-deepseek-fault-r2`
- `authorization-deepseek-evolution-r1`
