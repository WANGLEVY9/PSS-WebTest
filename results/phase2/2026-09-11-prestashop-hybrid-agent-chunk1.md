# PrestaShop Hybrid Agent chunk 1/5 (2026-09-11)

## Protocol

This is the first of five independent 100-run reset blocks for the fixed Hybrid Agent stratum. The five blocks together preserve the 500-run distribution used by the traditional arm: 200 simple, 175 medium, and 125 complex executions. This block used Aliyun-compatible `qwen3.7-flash`, profile `aliyun-qwen-grounded-v1`, semantic Hybrid actions, one worker, fresh browser contexts, append-only run records, replay artifacts, and an independent product database oracle. The block is exploratory diagnostic evidence; it is not a matched or confirmatory estimate.

## Results

| Workflow | Planned | Completed | Failures | Task state reached | Independent oracle passed |
|---|---:|---:|---:|---:|---:|
| simple search | 40 | 40 | 0 | 40 | 40 |
| medium search/open | 35 | 35 | 0 | 35 | 35 |
| complex search/open/back/reopen | 25 | 9 | 16 | 9 | 25 |
| **total** | **100** | **84** | **16** | **84** | **100** |

All 16 failures were classified as `grounding-loop`; there was no provider-format, SUT health, or database snapshot failure in this block. The independent oracle remained true for all 100 runs, including failed agent runs, so these are navigation-agent failures rather than catalog-data loss. The simple and medium paths were stable in this block; the complex back-and-reopen path is the current Hybrid failure boundary.

## Gate status

The controller reported `completed-diagnostic-batch`, with HTTP 200 health before/after and unchanged database snapshot. The remaining four blocks are still required before reporting a 500-run arm total. No superiority or confirmatory claim is made.

Raw JSONL and replay images remain under ignored `artifacts/phase2/` paths; this public record contains only de-identified aggregates.
