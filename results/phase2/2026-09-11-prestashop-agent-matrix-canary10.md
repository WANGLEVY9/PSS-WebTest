# PrestaShop Aliyun agent matrix canary-10 (2026-09-11)

## Protocol

Two arm-specific 10-run blocks were executed on the same `simple=5, medium=3, complex=2` distribution. Each arm block was preceded by a clean PrestaShop reset and database snapshot; the controller checked HTTP health every five observations and wrote one redacted run record per execution. These are exploratory diagnostics, not a matched three-arm admission block or confirmatory result.

Provider/model/profile: `aliyun / qwen3.7-flash / aliyun-qwen-grounded-v1`.

## Results

| Arm | n | Simple | Medium | Complex | Total task-state success | Independent DB oracle |
|---|---:|---:|---:|---:|---:|---:|
| Pure visual | 10 | 0/5 | 0/3 | 0/2 | 0/10 | 10/10 |
| Hybrid | 10 | 5/5 | 3/3 | 0/2 | 8/10 | 10/10 |

Visual failures: 9 `grounding-loop`, 1 `execution` (all oracle checks passed). Hybrid failures: 1 `grounding-loop` and 1 task-state `oracle` boundary on the complex revisit workflow (both database checks passed). The hybrid complex failures reached or attempted the first product detail but did not satisfy the required back-and-reopen milestone.

Artifacts:

- Visual records: `artifacts/phase2/prestashop-aliyun-visual-matrix-canary10-20260911.jsonl`
- Visual summary: `artifacts/phase2/prestashop-aliyun-visual-matrix-canary10-20260911-summary.json`
- Hybrid records: `artifacts/phase2/prestashop-aliyun-hybrid-matrix-canary10-20260911.jsonl`
- Hybrid summary: `artifacts/phase2/prestashop-aliyun-hybrid-matrix-canary10-20260911-summary.json`

The original PrestaShop cell runner emitted the legacy v0.1 agent record with a model id but no provider id. The controller summary and this report retain the explicit `aliyun/qwen3.7-flash` environment, while the dashboard now labels those legacy records as `unknown-provider` rather than silently calling them scripted. New records include `provider_id` in the v0.1 provenance whitelist.

## Attribution and decision

The clean reset, authentication, SUT health gates, and independent relational oracle all passed. The observed gap is therefore not attributable to an infrastructure outage or oracle contamination in this block. Under the current model/profile, Hybrid is reliable for simple and medium navigation but remains unreliable on the explicit revisit sequence; Pure visual remains unreliable even for the shorter search tasks. Keep these results as model/profile diagnostic evidence, preserve provider strata, and do not freeze repetition or start confirmatory collection from them.
