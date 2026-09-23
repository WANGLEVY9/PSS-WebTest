# PSS-WebTest

PSS-WebTest studies recurring errors and reliability in computer-use agents and scripted Web testing. It contains benchmark integration code, native outcome analysis, and tools for recording and inspecting executions.

[简体中文](README.zh-CN.md) · [Current experiment guide](docs/EXPERIMENT-OPERATIONS.zh-CN.md) · [Architecture](code/ARCHITECTURE.md) · [Research design](docs/RESEARCH.md) · [Reproduction](docs/REPRODUCIBILITY.md)

## Current experiment

The next operator campaign is **WebArena-Verified (WAV) only**. The plan compares GPT-6 Astra and GPT-5.6 Sol on the same 120 tasks, with AgentLab visual, AgentLab hybrid, restricted Browser Use hybrid, and one shared Playwright baseline. One round would comprise 720 model-driven executions and 120 baseline executions, **840 in total**. The 2-task and 10-task waves are development gates within the 120-task target.

This is a plan, not a completed experiment. Task IDs, exact API model identities, deployment bindings and full dispatcher support remain open. The machine-readable [current campaign plan](code/config/current-campaign.json) records `dispatcher_available=false` and `confirmatory_authorized=false`. The [scope decision](docs/WAV-ONLY-EXECUTION-SCOPE.md) explains the change. VWA and ATA collection is paused for this campaign.

The older `pss-manuscript-v2.1` contract remains available for analysis and protocol history. Its **322,164 scheduled opportunities** are a historical three-benchmark design denominator, not the current WAV campaign or a completed-run count. Use [the design guide](docs/RESEARCH.md) when interpreting that contract; do not dispatch the WAV campaign from it.

## Code and verification

The [code map](code/ARCHITECTURE.md) identifies configuration, runtime, framework adapters, evaluation, analysis and local observation. `code/experiment/` currently holds most benchmark integration modules; Earlier local-application source and its dedicated tests are preserved in the ignored `temp/` archive. Local historical evidence and retired configuration live in the ignored `temp/` archive.

For source-only checks, install Node.js 20+, Python 3 and Playwright Chromium:

```sh
cd code
npm ci
npx playwright install chromium
npm run campaign:validate
npm run study:validate
mkdir -p artifacts/local-runtime
npm run sponsor:verify:portable -- --python python3 --output artifacts/local-runtime/offline-001
```

Use a new output directory for every verification. These checks do not call a model or execute official benchmark tasks. `study:validate` checks the historical manuscript contract; `campaign:validate` checks the current WAV plan. Neither authorizes collection. The [reproduction guide](docs/REPRODUCIBILITY.md) explains the different verification layers and remaining acceptance requirements.

From the repository root, run `node scripts/check-docs.mjs` and `./scripts/check-public-boundary.sh` before publishing. The boundary check examines Git's index; it does not remove data from already published Git history.

## Data and citation

The repository excludes private manuscripts, raw runs, credentials, internal mock discussions and local archives. See [data availability](docs/DATA_AVAILABILITY.md) for release status. Public paper, DOI and execution-level replication links are forthcoming. Synthetic fixtures and offline checks are engineering evidence, not measured research outcomes.

Use [CITATION.cff](CITATION.cff) and record the exact commit. Project-owned code and documentation use the [MIT License](LICENSE); upstream benchmark, framework and application materials retain their own terms. [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)
