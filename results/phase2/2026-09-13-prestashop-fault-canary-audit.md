# PrestaShop functional-fault matched canary audit — 2026-09-13

Evidence boundary: T1 diagnostic evidence only; no confirmatory claim or repetition freeze.

Workflow `prestashop-buyer-search-product` used the gated `search-result-label-omission` mutation. The independent relational snapshot remained unchanged for every executed cell.

| Stratum | Playwright | Pure visual | Hybrid | Notes |
|---|---:|---:|---:|---|
| Aliyun/Qwen 3.7 Flash | 1/1 | 0/1 | 0/1 | agent-step-budget; both agent records reached the faulty state and oracle passed, but did not terminate with the fault verdict |
| DeepSeek V4 Flash Vision | 1/1 | 0/1 | 1/1 | pure visual stopped at grounding-loop; hybrid detected and emitted fault |

Ledger audit: 6 records, 6 unique run IDs, no schema errors or duplicate IDs. The observed pattern is a conditional fault-detection boundary, not evidence of a universal ranking: the same fault is handled by DeepSeek hybrid but not by Qwen agents under this single repetition, while Playwright is deterministic in this canary.

## UI-evolution companion canary

The same matched workflow under the behavior-preserving `search-layout-preserving-v1` mutation completed 6/6 strict runs: Playwright, Qwen visual/hybrid, and DeepSeek visual/hybrid each reached the clean oracle. This is a single diagnostic repetition and does not establish stability under repeated UI evolution.
