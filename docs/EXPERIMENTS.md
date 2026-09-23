# Experiment design and operator map

[Project home](../README.md) · [简体中文](EXPERIMENTS.zh-CN.md) · [Research design and RQs](RESEARCH.md) · [Technical index](technical/README.md)

This page describes the benchmark and execution cells, their inputs, run sequence, native evaluation, configuration, and analysis entry points. Each experiment follows the same rule: freeze official tasks and environment, reset independently, restrict actor observations, preserve original execution evidence, and assess outcomes with the benchmark's own evaluator.

## Study design at a glance

The study samples 600 WAV tasks, 700 VWA tasks, and all 113 ATA cases (62 PASS, 51 FAIL). Six model identities are crossed with three agent cells—AgentLab visual v, AgentLab hybrid h, and restricted Browser Use hybrid u—plus one Playwright script cell shared across models. This gives 19 configurations per benchmark. Each task/configuration has two discovery rounds (D1–D2) and ten validation rounds (V1–V10). A scheduled opportunity is benchmark × task × configuration × round.

| Benchmark | v: AgentLab visual | h: AgentLab hybrid | u: Browser Use hybrid | s: Playwright script | Sample |
|---|---|---|---|---|---:|
| [WAV](technical/benchmarks/WAV.md) | Screenshot | Screenshot + visible controls | Screenshot + visible controls | Shared script | 600 tasks |
| [VWA](technical/benchmarks/VWA.md) | Screenshot | Screenshot + visible controls | Screenshot + visible controls | Shared script | 700 tasks |
| [ATA / piñata](technical/benchmarks/ATA.md) | Screenshot | Screenshot + visible controls | Screenshot + visible controls | Shared script | 113 cases |

The script cell is prepared and scheduled once per benchmark and shared across the six model comparisons; it is not copied into six independent observations.

## Benchmark procedures

### WAV — WebArena-Verified

1. Pin the WebArena-Verified source and official task IDs. Preserve templates, task input, declared sites, and ordered start URLs.
2. Separate public actor input from trusted setup and private evaluator references. Deploy the sites required by the selected tasks and bind accounts, start pages, and environment baseline.
3. Reset independently for each task × configuration × round; execute one of v, h, u, or s.
4. Preserve the original FinalAgentResponse and full HAR. Close the browser, then pass the task, original output, and HAR to the pinned WAV evaluator.
5. Record native score, scorable status, actor termination, reset/execution/finalization time, and operational correctness separately.

**Assessment:** The HAR is evaluator evidence and must not enter later actor observations. A later successful score cannot override an actor timeout. Report the selected workload and coverage; do not present it as the full upstream leaderboard score.

References: [WAV native specification](technical/benchmarks/WAV.md) · [cloud deployment and acceptance](../code/experiment/cloud-handoff/README.md) · [runtime lifecycle](../code/docs/runbooks/LIFECYCLE-AND-NATIVE-EVALUATION.md)

### VWA — VisualWebArena

1. Pin the source and site-namespaced task IDs. Preserve original task images, task configuration, and ordered start pages.
2. Deploy the site closure required by the selection, such as Classifieds, Shopping, Reddit, Wikipedia, or Homepage. Bind accounts, image dependencies, and complete data restoration.
3. Restore an independent environment for every task × configuration × round and run the selected agent or shared Playwright script.
4. After the actor's native STOP output, evaluate the final live page before closing the browser; then seal the page, result, and source evidence.
5. Record deterministic and judge-dependent evaluators separately. Store judge model, prompt, cost, and control results as part of the evaluation configuration.

**Assessment:** Run the evaluator on the final live page. A new page or task replay is not equivalent. Freeze and control judge-dependent tasks, and report evaluator coverage by path.

References: [VWA native specification](technical/benchmarks/VWA.md) · [fixture deployment](../code/docs/runbooks/VWA-FIXTURE-DEPLOYMENT.md)

### ATA / piñata

1. Pin the published release, all 113 official cases, source step labels, and CSV/ZIP hashes. Preserve the published PASS/FAIL classes and original step numbering.
2. Give the actor only the public assertion steps. Keep verdict, failure-step reference, and failure annotations in evaluator-only input.
3. Restore an independent fixture for every task × configuration × round; require the common completion schema.
4. Return JSON such as {"verdict":"FAIL","failure_step":2}. PASS, FAIL, and null are allowed verdicts. Only FAIL may include a positive source step; other verdicts require a null failure_step.
5. Compare each output with the published reference. Report verdict coverage, accuracy, sensitivity, specificity, and failure-step alignment among true positives separately.

**Assessment:** FAIL is the positive class. Reference comparison establishes agreement with published labels; operational correctness also requires independent evidence that the live application state and labels match. Null is abstention, not FAIL.

References: [ATA native specification](technical/benchmarks/ATA.md) · [official source population](../code/config/ata-source-population.v1.json)

## Configure the execution paradigms

| Cell | Actor input | Run sequence | Information to withhold | Entry points |
|---|---|---|---|---|
| **v — AgentLab visual** | Current screenshot, public task/images, accepted action history, generic action errors, remaining budget | AgentLab GenericAgent returns one action; PSS validates and executes it through the journaled actuator | DOM/AX, OCR, selectors, URL control flow, hidden page state, evaluator state | [AgentLab](technical/frameworks/AGENTLAB.md) · [BrowserGym](technical/frameworks/BROWSERGYM.md) · [framework_agentlab.py](../code/experiment/framework_agentlab.py) |
| **h — AgentLab hybrid** | All v inputs plus a projection of controls visible in the current observation | Match v on model, task, reset, actuator, and budget; add only the visible-control projection | Raw HTML, hidden/offscreen text, stable application IDs, CSS/XPath, private API | [Input/output contract](technical/INPUT_OUTPUT.md) · [framework_boundary.py](../code/experiment/framework_boundary.py) |
| **u — Browser Use hybrid** | Same screenshot and restricted visible controls as h | Call Browser Use's decision/schema component and execute one action through the shared PSS actuator | Default tools/recovery/planning, direct URL opening, hidden fallback, multi-action output | [Browser Use](technical/frameworks/BROWSER_USE.md) · [framework_browser_use.py](../code/experiment/framework_browser_use.py) |
| **s — Playwright script** | Public UI/DOM/AX during preparation; frozen script during execution | Reset per benchmark/task, run the reviewed script, then use the same native evaluator | Evaluator internals, gold, private API/database truth, agent traces, runtime LLM | [Playwright](technical/frameworks/PLAYWRIGHT.md) · [traditional_actor.py](../code/experiment/traditional_actor.py) |

AgentLab uses BrowserGym environment/action components; BrowserGym is not an additional study arm. v versus h tests input structure within AgentLab; h versus u compares framework implementations under the same hybrid boundary; s supplies the scripted baseline. Browser Use has no visual cell, so this is not a full framework × input factorial design.

**Matched fields:** task ID, model and returned API identity, prompt, framework/browser version, viewport, locale, timezone, action/time/cost limits, site data, reset state, output schema, and evaluator version. Script authors remain blind to agent outcomes and evaluator references. Record preparation, debugging, and review effort.

## Research questions and analysis

1. **RQ1: native task effectiveness.** Aggregate WAV by task-template macro, VWA by task, and ATA by verdict/step rules. Report scorable coverage; do not pool unlike benchmark outcomes.
2. **RQ2: reliability on a fixed workload.** Retain all selected tasks and rounds. Keep preparation and operational failures in the denominator; preserve unknown outcomes as null with identification bounds. Separate preparation effort, execution cost, and coverage.
3. **RQ3: recurring errors and same-class controls.** D1–D2 identify visual-cell errors and correct controls of the same reference class; V1–V10 provide fresh paired validation. Report comparator gain over visual and the difference after subtracting same-class control gain.
4. **RQ4: complementarity and retry.** Treat V1–V5 and V6–V10 as two windows. For the same eligible blocks with outcomes (c1,c2,d1,d2) for configurations c and d, calculate mixed = (max(c1,d2) + max(c2,d1)) / 2. Compare it with retry-c = max(c1,c2) and retry-d = max(d1,d2). This is offline outcome analysis, not a live router.

The [research design](RESEARCH.md) defines estimands, denominator rules, and missing-data treatment. Planning, input binding, and import use [study-pipeline.mjs](../code/analysis/study-pipeline.mjs) and [study-workflow.mjs](../code/analysis/study-workflow.mjs). The runtime ledger and worker are [runtime_store.py](../code/experiment/runtime_store.py) and [runtime_worker.py](../code/experiment/runtime_worker.py); summaries use [study-analysis.mjs](../code/analysis/study-analysis.mjs).

## Initialize and validate configuration

From code/:

~~~sh
npm ci
npm run study:validate
npm run sponsor:verify:portable -- --python python3 --output artifacts/local-runtime/NEW_NAME
~~~

Use these commands to check source, study contracts, and offline runtime invariants. Measured runs follow the task binding, fixture reset, isolated execution, native assessment, and evidence-sealing procedure above. Benchmark configuration lives under code/config/ and framework profiles under code/config/frameworks/. Each run uses a separate schedule, runtime bindings, and output directory.

See [reproduction](REPRODUCIBILITY.md) for environment/evidence layers and [architecture](../code/ARCHITECTURE.md) for module boundaries.
