# PSS-WebTest

PSS-WebTest is an empirical study of computer-use agents and scripted Web testing. It compares task success and reliability across benchmark-native web tasks, visual and hybrid agent inputs, framework implementations, and a shared Playwright baseline.

[简体中文](README.zh-CN.md) · [Experiment map](docs/EXPERIMENTS.md) · [Architecture](code/ARCHITECTURE.md) · [Research design](docs/RESEARCH.md) · [Reproduction](docs/REPRODUCIBILITY.md)

## Benchmarks and study samples

| Benchmark | Study sample | Native task assessment |
|---|---:|---|
| [WebArena-Verified (WAV)](docs/technical/benchmarks/WAV.md) | 600 tasks | Preserve the structured agent completion and network trace; score with the pinned WAV evaluator. |
| [VisualWebArena (VWA)](docs/technical/benchmarks/VWA.md) | 700 tasks | Assess the final live page with the VWA task evaluator, including the declared judge policy where required. |
| [ATA / piñata](docs/technical/benchmarks/ATA.md) | 113 cases: 62 PASS, 51 FAIL | Compare predicted verdict and failure step with the published reference; report verdict and step alignment separately. |

The sample is crossed with six model identities and three agent cells, plus one Playwright script cell shared across models: 19 configurations. Each task/configuration has two discovery rounds (D1–D2) and ten validation rounds (V1–V10). The scheduled unit is benchmark × task × configuration × round.

## Execution paradigms

| Cell | Framework and input | Experimental role |
|---|---|---|
| Visual (v) | [AgentLab](docs/technical/frameworks/AGENTLAB.md) with [BrowserGym](docs/technical/frameworks/BROWSERGYM.md); screenshot and permitted interaction state | Measures screenshot-only interaction without DOM, accessibility tree, external OCR, selectors, or evaluator state. |
| Hybrid (h) | AgentLab / BrowserGym; screenshot plus restricted visible-control projection | Adds only controls visible in the current observation. Compare with v under the same tasks, model, environment, and budget. |
| Hybrid framework (u) | [Restricted Browser Use](docs/technical/frameworks/BROWSER_USE.md); the same hybrid information boundary | Compares framework decisions under matched hybrid inputs. Browser Use has no visual-only cell, so the framework/input crossing is partial. |
| Scripted baseline (s) | [Playwright](docs/technical/frameworks/PLAYWRIGHT.md); reviewed public-UI script, no runtime LLM | Provides one shared scripted baseline per benchmark. Preparation is blinded to evaluator internals, references, and agent outcomes. |

The full benchmark-by-method procedures, input contracts, reset/evaluation order, analysis questions, and code entry points are in the [experiment map](docs/EXPERIMENTS.md).

## Running the study

For each benchmark, freeze official task IDs, source and evaluator versions, model/API identities, prompts, browser and framework versions, budgets, environment bindings, and the analysis schedule before execution. Prepare every benchmark/configuration/round with an independent reset, execute one declared method, retain its original completion and trace, then run the benchmark-native evaluator. Keep preparation failures, operational failures, unresolved outcomes, and successful scores distinct in the analysis denominator.

The [research design](docs/RESEARCH.md) specifies RQ1–RQ4 and their estimands. The [reproduction guide](docs/REPRODUCIBILITY.md) describes environment setup and evidence collection. The [data policy](docs/DATA_AVAILABILITY.md) describes the public artifact boundary.

To initialize the source environment and check the study contracts, from code/ run:

~~~sh
npm ci
npm run study:validate
npm run campaign:validate
npm run sponsor:verify:portable -- --python python3 --output artifacts/local-runtime/NEW_NAME
~~~

These commands validate source and configuration contracts. They do not call a model or execute benchmark tasks. Use [CITATION.cff](CITATION.cff) and record the exact commit when citing the software. Project-owned code and documentation use the [MIT License](LICENSE); upstream benchmark, framework, and application materials retain their own terms.
