# Experiment code

[Project overview](../README.md) · [Architecture](ARCHITECTURE.md) · [WAV operator guide](../docs/EXPERIMENT-OPERATIONS.zh-CN.md) · [Reproducibility](../docs/REPRODUCIBILITY.md)

The next experiment is the WAV-only 120-task plan in [`config/current-campaign.json`](config/current-campaign.json). It is planning metadata: the exact tasks, model API identities and full dispatcher are not yet bound. The older [`config/active-study-design.json`](config/active-study-design.json) remains for the manuscript analysis contract and must not dispatch this campaign.

## Layout

| Path | Role |
| --- | --- |
| `config/` | Campaign and research contracts, framework pins and example private bindings |
| `experiment/` | Runtime, framework adapters, native evaluation and offline verification |
| `analysis/` | Research protocol, record import and outcome analysis |
| `console/` | Local evidence inspection and execution gate display |
| `tests/experiment/` | Node and browser tests for maintained experiment code |
| `tools/` | Diagnostic report processing; no model calls |
| `artifacts/` | Ignored local inputs, trajectories and verification reports |

Older local-application runners and tests are kept only in the ignored `../temp/` archive. The [architecture guide](ARCHITECTURE.md) explains module responsibilities and evidence boundaries.

## Install and verify

Use Node.js 20+, Python 3 and Playwright Chromium. These commands use synthetic fixtures and make no model requests:

```sh
npm ci
npx playwright install chromium
npm run campaign:validate
npm run study:validate
npm run test:experiment
npm run test:diagnostic-merge
mkdir -p artifacts/local-runtime
npm run sponsor:verify:portable -- --python python3 --output artifacts/local-runtime/offline-001
```

The output directory must be new. The verifier checks source hashes before and after execution and records every test group's count. It does not validate a sponsor host, official task reset, native evaluator integration or research results.

## Entry points

| Task | Command |
| --- | --- |
| Validate current WAV planning metadata | `npm run campaign:validate` |
| Validate historical manuscript contract | `npm run study:validate` |
| Verify retained offline source | `npm run sponsor:verify:portable -- --python python3 --output NEW_DIRECTORY` |
| Inspect local evidence | `npm run sponsor:console` |
| Analyze a supplied research bundle | `npm run study:workflow -- import INPUT.json NEW_DIRECTORY` |
| Merge Qwen diagnostic slices | `node tools/merge-wav-qwen-pair.mjs NEW_OUTPUT.json BATCH_DIR...` |

For the next paid WAV run, follow the [operator guide](../docs/EXPERIMENT-OPERATIONS.zh-CN.md). A passing offline check does not open the execution gate.
