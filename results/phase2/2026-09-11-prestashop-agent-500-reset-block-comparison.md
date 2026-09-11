# PrestaShop CUA/Hybrid 500-run reset-block comparison (2026-09-11)

## Scope and evidence boundary

Pure Visual and Hybrid were each collected as five independent 100-run reset blocks. Each arm therefore has exactly 500 observed executions with the same fixed complexity distribution (200 simple, 175 medium, 125 complex), one worker per block, fresh browser contexts, the same Aliyun-compatible `qwen3.7-flash` provider/model/profile (`aliyun-qwen-grounded-v1`), independent database oracle, and before/after health/database gates. Pure Visual received screenshots only; Hybrid received screenshots plus the declared visible page structure and semantic target IDs.

These are aligned exploratory diagnostic batches. They are not a preregistered three-arm matched estimate, do not freeze repetition counts, and do not support a universal superiority claim. The previous continuous Hybrid 500 attempt that OOM-killed MySQL is excluded from these reset-block totals and retained as separate capacity-boundary evidence.

## Pooled results

| Arm | Simple (200) | Medium (175) | Complex (125) | Total completed / 500 |
|---|---:|---:|---:|---:|
| Pure Visual CUA | 118 (59.0%) | 116 (66.3%) | 22 (17.6%) | **256 (51.2%)** |
| Hybrid Agent | 182 (91.0%) | 160 (91.4%) | 39 (31.2%) | **381 (76.2%)** |

The independent product database oracle passed for all 500 observations in each arm. This means the failed runs were not catalog-data loss. All ten reset blocks reported completed diagnostic status, HTTP 200 health before/after, and unchanged database snapshots.

## Failure boundaries

| Arm | Dominant failure categories (all complexities) |
|---|---|
| Pure Visual | grounding-loop 111; agent-step-budget 95; provider-format 18; execution 12; oracle 8 |
| Hybrid | grounding-loop 76; execution 43 |

The strongest conditional pattern is task complexity: both agents are much less reliable on the browser-back/reopen workflow than on search or search/open. Under this provider/profile, Hybrid retains a higher completion rate in every matched complexity stratum, while Pure Visual has additional coordinate grounding, step-budget, and format failures. These are hypotheses for the next matched analysis, not final causal conclusions: the runs are currently diagnostic, the provider/model is one stratum, and Playwright must be collected under the same reset-block protocol before a three-arm comparison.

Raw run records, screenshots, and provider summaries remain under ignored `artifacts/phase2/`; only the de-identified aggregates are committed.
