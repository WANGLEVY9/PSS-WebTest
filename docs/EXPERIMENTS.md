# Experiment map and operator quick reference

[Project home](../README.md) · [简体中文](EXPERIMENTS.zh-CN.md) · [Research design and RQs](RESEARCH.md) · [Reproduction layers](REPRODUCIBILITY.md)

This page summarizes the study cells, how each method is executed and scored, and which preparations are currently possible. See the [technical index](technical/README.md) for benchmark semantics and the [WAV operator guide](EXPERIMENT-OPERATIONS.zh-CN.md) for the current environment/configuration handoff.

## Keep the two study plans separate

| Plan | Benchmarks and denominator | Configurations and repetitions | Status |
|---|---|---|---|
| Current development campaign | 120 WAV tasks; each has three agent cells and one shared Playwright baseline | GPT-6 Astra and GPT-5.6 Sol; 720 planned agent executions plus 120 planned script executions, 840 total | Planning/development only. Task IDs are not frozen, API identities and deployment are unbound, the dispatcher is unavailable, and execution/confirmatory collection are unauthorized. |
| Historical manuscript design, pss-manuscript-v2.1 | WAV 600, VWA 700, ATA 113; 1,413 tasks total | Six model labels × three agent cells plus one shared script; D1–D2 discovery and V1–V10 validation, 12 rounds | Research and analysis contract, not the current schedule or completed-run inventory. 322,164 is the planned opportunity count. |

Display labels are not provider API model IDs. Before any measured campaign, freeze actual provider and returned model identity, task IDs, framework version, information boundary, budget, environment, and evaluator version. Never combine the historical denominator with the WAV-only plan.

## Benchmark quick reference

| Benchmark | Tasks and environment | Assessment after execution | Main readiness gates | Technical guide |
|---|---|---|---|---|
| **WAV** | Pin WebArena-Verified and official task IDs. Deploy only sites required by the frozen selection. Bind start pages, authentication, and task inputs; restore the fixture independently for every execution. | Preserve the original FinalAgentResponse and full HAR. After closing the browser, call the pinned native evaluator. A later score cannot override an actor timeout. | The current 120 task IDs, GPT API IDs, Linux lock, site closure, reset/isolation, native positive/negative controls for all four profiles, and batch dispatcher are outstanding. | [WAV specification](technical/benchmarks/WAV.md) · [operator guide](EXPERIMENT-OPERATIONS.zh-CN.md) · [lifecycle/acceptance runbook](../code/docs/runbooks/ACCEPTANCE-RUNBOOK.md) |
| **VWA** | Pin VisualWebArena and site-namespaced task IDs. Preserve task images and ordered start pages; prepare required sites, accounts, data, and a complete restore procedure. | After the actor's native STOP output, run the evaluator on the final live page before closing the browser; then seal the result and source evidence. Freeze, cost, and control any judge-dependent path. | The historical 700-task selection is not a frozen list. Database/file restore, image dependencies, authentication, judge paths, task coverage, and peer isolation need target-host acceptance. | [VWA specification](technical/benchmarks/VWA.md) · [fixture deployment](../code/docs/runbooks/VWA-FIXTURE-DEPLOYMENT.md) |
| **ATA / piñata** | Pin the 113 published cases and source step labels. The actor receives public assertion steps, never PASS/FAIL reference labels or failure annotations. | Require strict verdict and failure_step output and compare it with the published reference. FAIL is the positive class. Report binary verdict correctness separately from failure-step alignment. | Establish source identity, application state, and label parity; cover PASS/FAIL, before/exact/after, ambiguity, abstention, and invalid output. The current implementation is a reference comparator, not an independent runtime oracle. An actor output has the form {"verdict":"FAIL","failure_step":2}; only FAIL may include a positive source step, while PASS and null verdicts require failure_step to be null. | [ATA specification](technical/benchmarks/ATA.md) · [source population](../code/config/ata-source-population.v1.json) |

The 812 WAV and 910 VWA counts are populations in their fixed upstream sources; the historical selected counts are 600 and 700. ATA contains all 113 published cases (62 PASS, 51 FAIL). Source population, planned selection, and successfully run count are different quantities.

## Execution-paradigm quick reference

| Cell | Execution | Conditions to hold fixed | Code and specification |
|---|---|---|---|
| **Visual v — AgentLab / BrowserGym** | Reset each task × round; provide screenshot and permitted interaction history; AgentLab returns one action, the restricted actuator executes it, and the benchmark-native evaluator scores completion. | No DOM/AX, external OCR, selectors, URL control flow, or hidden/evaluator state. Record images, viewport, actions, requests, and actual model identity. | [AgentLab](technical/frameworks/AGENTLAB.md) · [BrowserGym](technical/frameworks/BROWSERGYM.md) · [framework_agentlab.py](../code/experiment/framework_agentlab.py) |
| **Hybrid h — AgentLab / BrowserGym** | Match v on task, model, decision path, environment, and budget. Add only a restricted projection of controls visible in the current screenshot. | Projection is limited to observation-local ID, role, accessible name, visible value/state, and bounding box. No raw HTML, hidden/offscreen fields, CSS/XPath, or stable internal IDs. | [Input/output contract](technical/INPUT_OUTPUT.md) · [framework_boundary.py](../code/experiment/framework_boundary.py) |
| **Hybrid framework u — restricted Browser Use** | Use the same hybrid boundary and native evaluator. PSS calls Browser Use's decision/schema component; the shared actuator executes exactly one action. | Disable default tools, recovery, planning, direct URL opening, and hidden fallback. done is a completion proposal, not a success label. | [Browser Use](technical/frameworks/BROWSER_USE.md) · [framework_browser_use.py](../code/experiment/framework_browser_use.py) |
| **Script s — Playwright** | A blinded preparer writes and reviews a fixed script using the public UI. Reset before each opportunity and score with the same benchmark evaluator. | No runtime LLM or private API/database truth. Record authoring, debugging, review effort, and failed preparation. Schedule one shared script per benchmark. | [Playwright baseline](technical/frameworks/PLAYWRIGHT.md) · [traditional_actor.py](../code/experiment/traditional_actor.py) |

BrowserGym supplies environment/action components used by AgentLab; it is not a fifth study arm. The historical three-benchmark by four-paradigm matrix is below. One script is shared per benchmark rather than repeated by model. The current campaign plans only the WAV row, and it is not dispatchable yet.

| Benchmark | Visual v | AgentLab hybrid h | Browser Use hybrid u | Playwright script s | Current status |
|---|---|---|---|---|---|
| [WAV](technical/benchmarks/WAV.md) | Planned | Planned | Planned | Shared baseline | 120-task development plan; task/API bindings and dispatcher are missing. |
| [VWA](technical/benchmarks/VWA.md) | Historical design | Historical design | Historical design | Historical design | No current campaign; restore, judge, and host acceptance are incomplete. |
| [ATA](technical/benchmarks/ATA.md) | Historical design | Historical design | Historical design | Historical design | No current campaign; fixture/reference-label parity is unverified. |

This is a partial crossing: v versus h compares inputs within AgentLab; h versus u compares frameworks under the hybrid boundary; s is the shared scripted baseline. Browser Use has no visual-only cell.

## Map the four research questions to records

1. **RQ1: benchmark-native effectiveness.** Score each round using WAV template, VWA task, or ATA verdict/step rules, and report coverage. Do not combine unlike outcomes into a cross-benchmark success rate.
2. **RQ2: reliability on a fixed workload.** Keep every selected task and repetition. Do not silently remove preparation failures or operational failures; retain genuinely unknown outcomes as null and report bounds. Separate preparation effort, execution cost, and availability.
3. **RQ3: recurring errors and same-class controls.** D1–D2 select visual errors and correct controls of the same reference class; V1–V10 supply fresh paired validation. Report comparator gain over visual and the excess gain after subtracting the same-class control gain. Because groups are selected using discovery outcomes, this is not a causal effect.
4. **RQ4: complementarity versus retry.** Treat V1–V5 and V6–V10 as two windows. On the same retained blocks, compare a mixture of two methods' first available outcomes with two retries of each method. For the same retained block with two-window outcomes (c1,c2,d1,d2), compute mixed = (max(c1,d2) + max(c2,d1)) / 2, then compare it with retry-c = max(c1,c2) and retry-d = max(d1,d2). This is offline outcome analysis, not an online router or a union of four attempts.

The [research design](RESEARCH.md) and v2.1 contract define estimands, denominators, and missing-data rules. One opportunity is a frozen task × configuration × round. Network retries, parser retries, and task replays are not new independent opportunities.

## Shared procedure: preparation through analysis

1. **Select the design authority.** Separate the current WAV plan from the historical v2.1 contract; freeze benchmark, population, RQs, cells, repetitions, and data boundary.
2. **Freeze inputs.** Record benchmark commit, official task IDs, task/config/evaluator hashes, real API model ID, prompt, framework/browser version, and action/time/cost limits. Select tasks outcome-blind; keep gold away from script preparers.
3. **Prepare isolated environments.** Bind sites, accounts, fixture version, and an evidenced reset. Restore independently per task × configuration × round. Do not parallelize a shared mutable fixture without proven isolation.
4. **Run each cell separately.** Preserve native completion. Record start/end, failures, usage/cost, setup, reset, finalization, and missingness. Never continue one method in another method's modified browser state.
5. **Assess independently.** Keep actor input separate from evaluator references. Save original output, assessment status, and evaluator source identity. Encode method failure, timeout, and unavailable assessment separately.
6. **Analyze against the frozen denominator.** Join schedule, receipt, and evaluator records; reconcile scheduled/prepared/started/scorable/completed counts. Compute RQ1–RQ4 using the research analysis workflow and review privacy/licensing before publication.

## Preparations available now

From the repository's code/ directory:

~~~sh
npm ci
npm run campaign:validate
npm run study:validate
npm run sponsor:verify:portable -- --python python3 --output artifacts/local-runtime/NEW_NAME
~~~

These are source and plan checks, not benchmark launches or model calls. The current campaign still lacks task IDs, provider model IDs, and a dispatcher. **This repository has no complete command to launch the 120-task GPT campaign.** Do not treat the Qwen diagnostic runner or historical v2.1 schedule as that dispatcher. Complete the [scope decision](WAV-ONLY-EXECUTION-SCOPE.md), bindings, and target-host acceptance in this guide before freezing a runnable campaign.

## Configuration and analysis entry points

- Current WAV development plan: [current-campaign.json](../code/config/current-campaign.json)
- Historical manuscript contract pointer: [active-study-design.json](../code/config/active-study-design.json)
- Benchmark source and selection manifests: [code/config/](../code/config/)
- Candidate framework locks: [code/config/frameworks/](../code/config/frameworks/); existing locks are not accepted Linux install locks
- Planning, binding, and import: [study-pipeline.mjs](../code/analysis/study-pipeline.mjs) · [study-workflow.mjs](../code/analysis/study-workflow.mjs)
- Runtime ledger and worker: [runtime_store.py](../code/experiment/runtime_store.py) · [runtime_worker.py](../code/experiment/runtime_worker.py)
- Native benchmark evaluators: [code/experiment/](../code/experiment/)
- RQ analysis: [study-analysis.mjs](../code/analysis/study-analysis.mjs)
- Reproduction layers: [reproduction guide](REPRODUCIBILITY.md) · [data availability](DATA_AVAILABILITY.md)
