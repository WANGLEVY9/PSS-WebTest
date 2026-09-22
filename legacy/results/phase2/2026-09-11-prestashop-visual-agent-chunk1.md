# PrestaShop Pure Visual Agent chunk 1/5 (2026-09-11)

## Protocol

This is the first of five independent 100-run reset blocks for the fixed Pure Visual CUA stratum. The pooled target is 500 executions with the same 200/175/125 simple/medium/complex distribution used by the traditional and Hybrid arms. This block used Aliyun-compatible `qwen3.7-flash`, profile `aliyun-qwen-grounded-v1`, screenshot-only observations, one worker, fresh browser contexts, append-only run records/replays, and an independent product database oracle. It is exploratory diagnostic evidence, not a matched or confirmatory estimate.

## Results

| Workflow | Planned | Completed | Failures | Task state reached | Independent oracle passed |
|---|---:|---:|---:|---:|---:|
| simple search | 40 | 26 | 14 | 26 | 40 |
| medium search/open | 35 | 24 | 11 | 24 | 35 |
| complex search/open/back/reopen | 25 | 2 | 23 | 2 | 25 |
| **total** | **100** | **52** | **48** | **52** | **100** |

Failure categories were: simple `agent-step-budget` 6, `grounding-loop` 7, `execution` 1; medium `grounding-loop` 6, `agent-step-budget` 3, `provider-format` 2; complex `agent-step-budget` 10, `grounding-loop` 11, `oracle` 1, `execution` 1. The database oracle passed for all observed runs, including failed agent executions, so these failures were not catalog-data loss.

The controller reported `completed-diagnostic-batch`, with HTTP 200 health before/after and unchanged database snapshot. Four blocks remain before a 500-run Pure Visual total is available. No cross-arm or superiority claim is made from this block.

Raw JSONL and replay images remain under ignored `artifacts/phase2/` paths.
