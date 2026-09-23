# PSS-WebTest

PSS-WebTest is an empirical study of computer-use agents and scripted Web testing. It examines benchmark-native task performance, reliability under repeated execution, recurring errors, and whether combining methods improves on retrying either method alone.

[简体中文](README.zh-CN.md) · [Experiment map](docs/EXPERIMENTS.md) · [Architecture](code/ARCHITECTURE.md) · [Research design](docs/RESEARCH.md) · [Reproduction](docs/REPRODUCIBILITY.md)

## Study scope

The research materials cover three benchmarks and four execution paradigms. The benchmark-specific evaluator defines correctness; a framework's own reward or a script assertion cannot replace it.

| Benchmark | Population and research selection | Native assessment | Current status |
|---|---|---|---|
| [WebArena-Verified (WAV)](docs/technical/benchmarks/WAV.md) | 812 source tasks; the historical manuscript design selected 600. The separate current development plan targets 120 frozen task IDs. | Original structured completion plus network trace, assessed by the pinned WAV evaluator. | Current campaign is WAV-only and planning/development scope. Task IDs and API identities are not bound; dispatcher and execution authorization are false. |
| [VisualWebArena (VWA)](docs/technical/benchmarks/VWA.md) | 910 source tasks; the historical manuscript design selected 700. | Native evaluator on the final live page; judge-dependent paths need a frozen, audited policy. | Historical study design and implementation reference. Restore, judge, and host acceptance remain incomplete. |
| [ATA / piñata](docs/technical/benchmarks/ATA.md) | 113 published cases: 62 PASS and 51 FAIL; the historical design uses the full population. | Predicted verdict and failure step compared with the published reference; operational correctness also requires independent live-fixture/label parity. | Historical study design and analysis reference; runtime parity remains unverified. |

The historical pss-manuscript-v2.1 contract schedules 1,413 tasks × 19 configurations × 12 rounds = **322,164 planned opportunities**. This is a design denominator, not a count of completed or imported runs. It must not be used to dispatch the current WAV campaign.

## Execution paradigms

| Cell | Framework and input | How the comparison works |
|---|---|---|
| Visual (v) | [AgentLab](docs/technical/frameworks/AGENTLAB.md) / [BrowserGym](docs/technical/frameworks/BROWSERGYM.md); screenshot and permitted interaction state only | Compares visual decisions with the same framework's hybrid cell. No DOM, accessibility tree, external OCR, selectors, or evaluator state. |
| Hybrid (h) | [AgentLab](docs/technical/frameworks/AGENTLAB.md) / [BrowserGym](docs/technical/frameworks/BROWSERGYM.md); screenshot plus a restricted projection of visible controls | Adds only observation-local IDs, roles, accessible names, visible values/states, and clipped bounds. Raw HTML and hidden state remain withheld. |
| Hybrid framework comparison (u) | [Restricted Browser Use](docs/technical/frameworks/BROWSER_USE.md); same declared hybrid information boundary | Compares two framework integrations under a shared input boundary. There is no Browser Use visual-only cell, so this is a partial framework/input crossing, not a full factorial design. |
| Scripted baseline (s) | [Reviewed Playwright script](docs/technical/frameworks/PLAYWRIGHT.md); public UI/DOM/AX during blinded preparation, no runtime LLM | One fixed baseline is shared across model comparisons. Preparation, debugging, and review effort are recorded; evaluator internals, gold, and agent traces are withheld. |

AgentLab uses BrowserGym components; BrowserGym is not an additional study arm. The historical manuscript design covers three benchmarks × four paradigms; the current WAV development plan covers only WAV's four cells. Each benchmark keeps its own native evaluator, and all VWA/ATA cells remain subject to target-environment acceptance. See the [experiment map](docs/EXPERIMENTS.md) for the per-benchmark procedure and setup links.

## What can be prepared now

The current campaign is a **120-task WAV development plan**: two display model labels (GPT-6 Astra and GPT-5.6 Sol), three agent cells (v, h, u) and one shared Playwright baseline, giving 720 planned model executions plus 120 planned script executions. The 2-, 10-, and 120-task waves are development gates. They are not completed runs.

Exact task IDs, API model identities, target bindings, and the full dispatcher are not available. The machine-readable [campaign plan](code/config/current-campaign.json) sets <code>dispatcher_available=false</code>, <code>new_execution_authorized=false</code>, and <code>confirmatory_authorized=false</code>. The [scope decision](docs/WAV-ONLY-EXECUTION-SCOPE.md) records why VWA and ATA are outside this campaign. Follow the [WAV operator guide](docs/EXPERIMENT-OPERATIONS.zh-CN.md) for the detailed environment and configuration handoff; it does not supply the missing dispatcher or authorize collection.

For source-only checks, install dependencies in code/ and run the plan and portable verification commands below. They do not call a model or execute official benchmark tasks.

~~~sh
cd code
npm ci
npm run campaign:validate
npm run study:validate
npm run sponsor:verify:portable -- --python python3 --output artifacts/local-runtime/NEW_NAME
~~~

## Research and evidence

The [research design](docs/RESEARCH.md) defines RQ1–RQ4, estimands, denominators, and missing-data treatment. The [experiment map](docs/EXPERIMENTS.md) links each benchmark and paradigm to its technical specification, code entry points, setup sequence, and evidence gates. The [data policy](docs/DATA_AVAILABILITY.md) states what is and is not publicly available.

Synthetic fixtures, injected framework responses, source checks, and local diagnostics are engineering evidence. They are not benchmark outcomes. Preserve scheduled, prepared, started, scorable, and completed counts separately.

Cite the software with [CITATION.cff](CITATION.cff) and record the exact commit. Project-owned code and documentation use the [MIT License](LICENSE); upstream benchmark, framework, and application materials retain their own terms.
