# PSS-WebTest code

Sponsor operators should start with the [GPT experiment operator README (中文)](../README-EXPERIMENT-OPERATORS.zh-CN.md) before configuring a paid run.

Current interface and implementation documentation: [technical index](../docs/technical/README.md), [inputs/outputs](../docs/technical/INPUT_OUTPUT.md), [native workflow traceability](../docs/technical/UPSTREAM_TRACEABILITY.md), and [cloud installation/dependency handoff](local-lab/cloud-handoff/README.md). Read these with the active v2.1 contract before adapting a runner.

[Project overview](../README.md) · [Research design](../docs/RESEARCH.md) · [Reproduction guide](../docs/REPRODUCIBILITY.md)

This directory contains the current benchmark integration/analysis/runtime work in `local-lab/` and the earlier local-application harness in `src/` and `scripts/`. The active study follows [`config/active-study-design.json`](config/active-study-design.json): WAV, VWA and ATA; nineteen configurations; twelve discovery/validation opportunities. Older pilot commands remain available for their original scope.

## Install and check

Requirements for source-only checks: Node.js 20+, Python 3, npm and Playwright Chromium. No API key or private data is needed.

```sh
# From this code/ directory
npm ci
npx playwright install chromium
npm run study:validate
mkdir -p artifacts/local-runtime
npm run sponsor:verify:portable -- \
  --python python3 --output artifacts/local-runtime/offline-001
```

Use `npx playwright install --with-deps chromium` on a fresh Linux host where system dependencies are needed. Every verification output directory must be new. Read test counts, skips, source-change detection and the explicit `not-run` historical artifact group in the report.

The portable verifier runs the installed local Node/browser tests, source-only contracts, Python runtime tests, ATA input projection and active design validation. It makes no model requests and executes no official benchmark tasks. Its synthetic fixtures are engineering checks, not study results.

## Entry points

| Purpose | Command from code/ | Notes |
| --- | --- | --- |
| Active design | `npm run study:validate` | Validates the current design pointer and scale |
| Portable source checks | `npm run sponsor:verify:portable -- --python python3 --output NEW_DIRECTORY` | Includes actual Chromium tests; output must be new |
| RQ formulas/import pipeline | `npm run test:study-analysis` | Synthetic analysis fixtures |
| Runtime recovery/accounting | `npm run test:runtime-reliability` | Python and Node regression |
| Local observatory | `npm run sponsor:console` | Loopback port 4173; gate status remains enforced |
| Analyze supplied input | `node local-lab/analyze-study.mjs INPUT.json NEW_REPORT.json` | See the input contract; does not validate underlying scientific truth |
| Plan/import supplied bundle | `node local-lab/study-workflow.mjs plan INPUT.json NEW_DIRECTORY` or `import` | Choose one subcommand; no dispatch or implicit cloud access |

Detailed input/round/metric semantics: [ANALYSIS-AND-ROUTING.md](local-lab/ANALYSIS-AND-ROUTING.md). Current changes and source/fixture constraints: [DESIGN-V2-MIGRATION.md](local-lab/DESIGN-V2-MIGRATION.md) and [adapter progress](local-lab/SPONSOR-ADAPTER-PROGRESS-2026-09-22.md).

## Code map

| Location | Responsibility |
| --- | --- |
| `config/active-study-design.json` | Sole active design pointer; older contracts are historical |
| `local-lab/study-analysis.mjs` | Native outcomes, operational bounds, error-conditioned controls and retry decomposition |
| `local-lab/study-pipeline.mjs` | Schedule construction, import reconciliation and analysis conversion |
| `local-lab/runtime_store.py` | Runtime ledger/recovery infrastructure |
| `local-lab/runtime_worker.py` | Diagnostic worker and trusted adapter receipt handling |
| `local-lab/runtime_inputs.py` | Restricted actor input and separate evaluator-reference preparation |
| `local-lab/framework_agentlab.py` / `framework_browser_use.py` | Framework-specific restricted components; full benchmark acceptance separate |
| `local-lab/server.mjs` | Local benchmark observatory |
| `tests/contracts/` | Shared contract/provenance checks and historical artifact integrations |
| `src/arms/`, `scripts/`, `manifests/` | Earlier local-SUT arms, lifecycle and pilot infrastructure |

## Prepare a new campaign

Use [SPONSOR-DEPLOYMENT.md](local-lab/SPONSOR-DEPLOYMENT.md). Separate the public study contract, private deployment profile, private runtime bindings and credentials. Exact API identities, matched budgets, framework/benchmark pins and fixture acceptance must be recorded before measured execution. Do not silently fall back to another model or relabel a custom runner as a study framework.

The active information boundary is stricter than generic screenshot-plus-DOM: hybrid receives only the allowed visible projection. Visual cannot use URL/DOM/AX for control-flow decisions. Evaluator truth and other-arm results are never actor inputs.

The current default worker is diagnostic. Frozen schedule/input hashes and valid receipts prevent specific integrity failures; they do not by themselves authorize formal collection or prove reset/evaluator correctness. The [status page](../docs/STATUS.md) distinguishes implementation, component probes and accepted benchmark execution.

## Historical harness

The earlier BookStack/Indico/Juice Shop/Invoice Ninja/PrestaShop runners remain for reproducing their dated pilots. They are outside the current core workload. Their package scripts include reset/mutation commands; inspect the named local fixture and original protocol before using them.

```sh
# Optional legacy checks; some require downloaded historical artifacts.
npm run test:contracts
npm run test:adapter-conformance
npm run test:phase2-provenance
npm run validate:manifests
npm run validate:configuration-registry
npm run validate:study-assets
```

`npm run dashboard:serve` is the earlier read-only inspection surface. It shares the observatory's default port, so start only one console at a time. Legacy registry versions and five-application readiness reports must not override the active v2.1 study contract.

## Local data

Keep keys in ignored env files and private runtime artifacts under `code/artifacts/`. For the OpenAI route, the example is [`local-lab/openai.env.example`](local-lab/openai.env.example); an accessible model identity is configured explicitly. Never publish keys, cookies or raw authenticated browser/provider traces. See [SECURITY.md](../SECURITY.md) and [data availability](../docs/DATA_AVAILABILITY.md).
