# PrestaShop Hybrid Agent: 500 reset-block diagnostic (2026-09-11)

## Design

The fixed Hybrid Agent stratum was run as five independent 100-run reset blocks because a single 500-run attempt caused the MySQL container to be OOM-killed (`Exited (137)`) and therefore failed its health gate. Each block used a fresh PrestaShop reset, one worker, Aliyun-compatible `qwen3.7-flash`, profile `aliyun-qwen-grounded-v1`, semantic Hybrid actions, fresh browser contexts, append-only run records/replays, and the independent product database oracle. The block distributions were 40 simple, 35 medium, and 25 complex; pooled across blocks this is exactly 200/175/125.

## Pooled result (500 planned, 500 observed)

| Workflow | Planned | Completed | Completion rate | Failure categories |
|---|---:|---:|---:|---|
| simple search | 200 | 182 | 91.0% | execution 18 |
| medium search/open | 175 | 160 | 91.4% | execution 15 |
| complex search/open/back/reopen | 125 | 39 | 31.2% | grounding-loop 76; execution 10 |
| **total** | **500** | **381** | **76.2%** | execution 43; grounding-loop 76 |

The database oracle returned the expected catalog row for all 500 observed runs, including every failed agent execution. Thus the failures are not catalog-data loss. The complex workflow is the dominant Hybrid boundary: repeated non-progressing navigation/grounding loops account for 76/86 complex failures. Simple and medium workflows are substantially more reliable under this provider/profile.

## Reset-block gate

All five reset blocks reported `completed-diagnostic-batch`, HTTP 200 before/after, and successful database snapshots. No block was merged after a health failure. The earlier continuous 500-run attempt remains separately classified as `incomplete` capacity-boundary evidence and is excluded from this pooled total.

This is still exploratory diagnostic evidence. It is not a three-arm matched estimate, does not freeze repetition counts, and does not support a universal superiority claim. Visual and Playwright blocks must be collected under the same reset-block protocol before any cross-arm conclusion.

Raw JSONL/replays remain under ignored `artifacts/phase2/`; only aggregates are public.
