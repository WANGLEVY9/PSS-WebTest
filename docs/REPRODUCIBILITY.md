# Reproducibility

[Project home](../README.md) · [Current WAV operator guide](EXPERIMENT-OPERATIONS.zh-CN.md) · [Architecture](../code/ARCHITECTURE.md) · [Research background](RESEARCH.md)

The next campaign is WAV-only. Its [planning contract](../code/config/current-campaign.json) fixes the intended comparison and denominator, but task IDs, exact API identities, budget bindings and full dispatcher support remain open. The historical three-benchmark contract is validated separately and must not dispatch the current campaign.

| Layer | What it establishes |
| --- | --- |
| Source-only verification | Current code imports, offline formulas, browser behavior and guarded runtime invariants |
| Host acceptance | Pinned framework and benchmark versions, task mapping, reset, observation and evaluator controls on one host |
| Research replication | Reviewed tasks and bindings, actual executions, sealed records and independently recomputed outcomes |

## Source-only check

From `code/`, with Node.js 20+, Python 3 and Playwright Chromium:

```sh
npm ci
npx playwright install chromium
npm run campaign:validate
npm run study:validate
mkdir -p artifacts/local-runtime
npm run sponsor:verify:portable -- --python python3 --output artifacts/local-runtime/offline-001
```

Choose a new output directory each time. The verifier records source hashes, test counts and logs. It performs no model calls or official benchmark tasks. Its report marks native acceptance as `not-run`, which cannot be read as a passing host gate.

The current WAV planning validator checks that 120 selected tasks, two models, three agent configurations, one shared baseline and one round imply 840 planned executions. It does not validate task selection or availability of an API model ID. `study:validate` checks the older manuscript contract only.

## Host and execution evidence

Follow the [WAV operator guide](EXPERIMENT-OPERATIONS.zh-CN.md) for pinned source checkout, environment deployment, private model configuration and the 2/10/120 development sequence. Store credentials, task selections, receipts and trajectories outside Git. Each execution must bind its task, model, framework, inputs, budget, environment and evaluator version before the run. Keep unsuccessful and missing attempts in the ledger.

The host acceptance record must include official task mapping, reset/isolation, framework observation and action controls, native evaluator positive/negative checks and spend accounting. A successful source-only run does not supply those results.

## Analysis and publication

`code/analysis/study-workflow.mjs` imports supplied records, and `code/analysis/study-analysis.mjs` computes summaries from their explicit denominator. Synthetic fixtures and local Qwen diagnostics are not confirmatory GPT campaign results. Share only reviewed, sanitized aggregates and the exact commit, protocol, source pins and exclusion decisions. The [data policy](DATA_AVAILABILITY.md) describes what is currently public.

From the repository root, check documentation and tracked publication paths:

```sh
node scripts/check-docs.mjs
./scripts/check-public-boundary.sh
```

The boundary check does not erase files already present in Git history. A historical purge requires a separately reviewed rewrite and coordinated replacement of the remote history.
