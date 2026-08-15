# Phase 1 — Scope and collision freeze

**Project:** PSS-WebTest (Pixels, Page Structure, or Scripts?)
**Audit date:** 2026-08-15
**Status:** scope freeze for study design; no confirmatory data collected
**Search boundary:** literature and public artifacts discoverable by 2026-08-15. This is a search-bounded collision audit, not a claim of exhaustive database coverage.

## 1. Audit question and eligibility rule

The collision question is:

> Does an existing empirical study compare a screenshot/pixel-only computer-use agent, a structured-page or hybrid agent, and/or a conventional accessibility-locator browser-test suite on matched Web UI test intents, with at least one of effectiveness, oracle correctness, UI-evolution robustness/repair, cost, latency, or repeated-run stability as a comparable outcome?

For the purpose of this project, a **full direct conflict** requires all of the following:

1. The workload is software testing or regression testing of Web applications, rather than general browsing or enterprise task completion.
2. At least one arm is screenshot/pixel-only CUA and at least one arm is a conventional scripted browser test suite.
3. The arms receive matched intents and are evaluated on the same application state or an equivalent paired design.
4. The study reports an independently checkable empirical outcome, not only a system demonstration or an agent's self-reported success.

Studies missing one or more elements are retained as **partial conflicts**, **methodological conflicts**, or **adjacent references**. The labels are intentionally stricter than “anything involving Playwright and an LLM,” because otherwise the novelty claim would conflate Web navigation, RPA, agent-generated scripts, and software testing.

## 2. Decision summary

### Research purpose

**Do not abandon the project.** The audit did not find a verified paper that performs the same three-arm, matched whole-workflow Web software-testing comparison with independent defect oracles, controlled behavior-preserving UI evolution, repair effort, operational cost/latency, and repeated-run stability.

However, the scope and novelty claim must be narrowed:

- Do **not** claim “the first comparison of CUA and Playwright” in general. `Anchor/ERP-Bench` already compares a pixel-only computer-use harness with an accessibility-resolved Playwright browser harness on matched enterprise workflows, with a common verifier and repeated trials, although it is not a Web software-testing study.
- Do **not** claim “the first agentic Web testing system to use Playwright, infer oracles, or study locator robustness.” `WebTestPilot` directly overlaps those components.
- Use a search-bounded formulation: **a controlled empirical comparison of Web UI test-automation approaches, centered on independent test oracles and robustness to behavior-preserving UI evolution**.

The working title can remain *Pixels, Page Structure, or Scripts?*, but the subtitle should identify **Web UI test automation under defects and UI evolution**, not generic browser automation.

## 3. Collision matrix

| Priority | Work (title; DOI/URL) | Classification | What is directly overlapping | What remains absent / consequence |
|---|---|---|---|---|
| 1 | **WebTestPilot: Agentic End-to-End Web Testing against Natural Language Specification by Inferring Oracles with Symbolized GUI Elements** (Teoh et al., PACMSE/FSE 2026), DOI `10.1145/3797115`, [paper](https://arxiv.org/html/2602.11724v3), [code](https://github.com/code-philia/WebTestPilot) | **Partial direct conflict** | Hybrid screenshot + DOM Web testing; four open-source apps; 100 injected bugs; narrow 40-case re-identification comparison against XPath, CSS, and Playwright. | No pure-visual CUA arm; Playwright is used mainly as an evaluation/oracle implementation, not a matched full-suite execution arm; no joint comparison of effectiveness, oracle correctness, repair effort, cost, latency, and stochastic stability. Avoid duplicating natural-language-to-E2E, symbolic oracle inference, and isolated locator re-identification as the main contribution. |
| 1 | **Anchor: Mitigating Artifact Drift in Agent Benchmark Generation** (Ivanov & Rana, RLEval 2026), arXiv DOI `10.48550/arXiv.2605.26321`, [paper](https://arxiv.org/abs/2605.26321), [benchmark](https://erpbench.ai) | **Near-direct methodological conflict (outside software testing)** | ERP-Bench evaluates pixel-coordinate CUA and a browser harness using a11y-resolved Playwright actions on identical Odoo 19 enterprise workflows, fresh containerized databases, one shared state verifier, and five trials per agent-task pair. | Tasks are procurement/manufacturing business operations, not test generation or regression testing; no seeded UI defects, behavior-preserving UI evolution, locator repair, test-oracle correctness, or authored test-suite baseline. We must not claim that no matched CUA-vs-Playwright Web workflow comparison exists. Cite it as the nearest paradigm precedent and explain why testing-specific outcomes remain open. |
| 1 | **Are LLM Agents the New RPA? A Comparative Study with RPA Across Enterprise Workflows** (Průcha et al., 2025), arXiv DOI `10.48550/arXiv.2509.04198`, [paper](https://arxiv.org/abs/2509.04198) | **Direct paradigm conflict outside testing** | Anthropic Computer Use versus UiPath on data entry, monitoring, and document extraction; speed, reliability, and development effort. | No Web software-testing benchmark, defect oracle, UI-evolution mutation, or authored browser-test baseline. Do not make a general “first CUA-versus-automation” claim; reuse its metric dimensions only as motivation. |
| 2 | **Are Autonomous Web Agents Good Testers?** (Chevrot et al., ISSTA 2025), DOI `10.1145/3728879`, [paper](https://arxiv.org/abs/2504.01495) | **Core predecessor** | Two autonomous Web test agents, 113 NL test cases, execution/verdict separation, multiple Web apps. | No traditional scripted baseline, no pure visual versus structured observation comparison, no controlled UI evolution or repair study. Preserve separate execution and verdict outcomes. |
| 2 | **WebTestBench: Evaluating Computer-Use Agents towards End-to-End Automated Web Testing** (Kong et al., 2026), arXiv DOI `10.48550/arXiv.2603.25226`, [paper](https://arxiv.org/abs/2603.25226), [code](https://github.com/friedrichor/WebTestBench) | **Core predecessor / partial benchmark overlap** | CUA-oriented Web testing benchmark; checklist generation and defect detection; Playwright MCP is the browser driver for its agent framework; reports coverage, precision, recall, and F1. | No conventional authored Playwright suite or matched three-arm comparison; its agents can inspect structured browser state. Use it as a task/evaluator candidate and avoid claiming novelty in CUA Web defect detection alone. |
| 2 | **How Benchmarks Mis-Score Computer-Use Agents** (Dong et al., 2026), arXiv DOI `10.48550/arXiv.2607.28367`, [paper](https://arxiv.org/abs/2607.28367) | **Methodological conflict / oracle guardrail** | Audit of 150 failure-scored trajectories from five Web, enterprise, and desktop benchmarks; 15.3% of FAIL verdicts were judged wrong (10.7% evaluator false negatives, 4.7% broken tasks); argues for evidence and diagnostic failure categories. | Does not compare test-automation arms or test-suite maintenance. It strengthens our requirement for independent hidden state/oracle checks, explicit broken-task labels, and trajectory evidence; do not rely on a single pass rate or agent self-report. |
| 2 | **GUI vs. CLI: Execution Bottlenecks in Screen-Only and Skill-Mediated Computer-Use Agents** (Zhou et al., 2026), arXiv DOI `10.48550/arXiv.2606.24551`, [paper](https://arxiv.org/abs/2606.24551) | **Adjacent matched-modality study** | 440 matched desktop tasks, screen-only GUI versus skill-mediated CLI, identical goals/states/final-state verifiers, repeated evaluations. | Desktop tasks and CLI skills are not Web test suites; no defects/UI evolution/repair. Supports our matched design, common verifier, and modality-specific failure taxonomy but does not collide with the Web-testing estimand. |
| 2 | **Skill Induction for Code Agents on Web Automation** (Wang, Sutawika & Neubig, Agent Skills 2026), [OpenReview](https://openreview.net/forum?id=GmCoFYNEIU), [PDF](https://openreview.net/pdf/59666fcb2f041cd399b463973b957417890524dc.pdf) | **Adjacent hybrid Web-agent study** | WebArena-Verified comparison of action-based/browser and code-native Playwright agents; same backbone subset and explicit isolated verification pipeline. | Not screenshot-only CUA, not software-testing, no authored Playwright regression baseline, defect oracle, or UI evolution. It supports treating “hybrid agent” as a distinct arm and recording verification isolation, not adding another confirmatory arm. |
| 2 | **Reliable execution of natural language test cases for GUI applications using LLM agents** (Salva, 2026), DOI `10.1007/s11219-026-09767-2`, [artifact](https://github.com/FondationUCA-Chair-LLM/NL-test-case-runnerv2) | **Adjacent Web/GUI testing study** | Guarded LLM execution and false-positive/false-negative reliability vocabulary across six applications. | No visual CUA or deterministic scripted baseline; no UI-evolution comparison. Reuse its oracle-error decomposition, not its task/arm design. |
| 2 | **GUI-Based Software Testing: An Automated Approach Using GPT-4 and Selenium WebDriver** (Zimmermann & Koziolek, 2023), DOI `10.1109/ASEW60602.2023.00028`, [paper](https://doi.org/10.1109/ASEW60602.2023.00028) | **Adjacent Web-testing study** | GPT-4 plus Selenium and monkey testing on a Web calculator; branch coverage. | LLM-assisted DOM/script generation is not screenshot-only CUA and no authored accessible-locator baseline. Use to distinguish DOM-aware LLM automation from CUA. |
| 2 | **AI Agents for Web Testing: A Case Study in the Wild** (Ye et al., 2025), arXiv DOI `10.48550/arXiv.2509.05197`, [paper](https://arxiv.org/abs/2509.05197) | **Adjacent visual testing case study** | Visual agent explores 120 public academic websites and reports 29 usability issues. | No matched conventional suite, independent functional oracle, or controlled UI evolution. Keep usability/visual outcomes separate from functional regression metrics. |
| 2 | **XTestGen: Natural Language to Maintainable E2E Test Scripts with LLMs** (Kirinuki et al., ICSME 2025), DOI `10.1109/ICSME64153.2025.00104`, [paper](https://doi.org/10.1109/ICSME64153.2025.00104) | **Adjacent hybrid deployment precedent** | Natural language to deterministic Gherkin/JavaScript E2E scripts; maintainability motivation. | Tool demo, not CUA-versus-suite empirical comparison. Treat agent-authored deterministic scripts as an optional exploratory arm, not a replacement for the three confirmatory arms. |
| 3 | **WebVoyager: Building an End-to-End Web Agent with Large Multimodal Models** (He et al., ACL 2024), arXiv DOI `10.48550/arXiv.2401.13919`, [paper](https://arxiv.org/abs/2401.13919) | **Reusable observation precedent** | Visual versus text/structured observations for Web navigation. | Not software testing or traditional suite comparison. Supports pure-visual versus structured observation ablation terminology. |
| 3 | **GUI-Robust: A Comprehensive Dataset for Testing GUI Agent Robustness in Real-World Anomalies** (Yang et al., 2025), arXiv DOI `10.48550/arXiv.2506.14477`, [paper](https://arxiv.org/abs/2506.14477), [code](https://github.com/chessbean1/GUI-Robust) | **Reusable mutation taxonomy** | Open anomaly types such as pop-ups, loading delays, and network failures. | Not a Web testing oracle or matched suite study. Use only as mutation-taxonomy input after runability and license checks. |

## 4. Search and snowball record

The existing project evidence covers four logged search rounds and forward/backward expansion from Chevrot et al., WebTestBench, WebTestPilot, and the RPA comparison. This audit added the following targeted queries on 2026-08-15:

- `"computer-use" "Playwright" web testing empirical comparison`
- `"visual agent" "Playwright" web testing benchmark`
- `"computer-use agents" traditional web UI testing Selenium Playwright`
- `"screen-only" "Playwright" browser agent matched tasks`
- `"computer-use" "accessibility" Playwright "same tasks" benchmark`
- `"pixel-coordinate" "Playwright" agent "same" tasks web`
- `"web application testing" "computer-use agent" Playwright`
- `"computer-use agent" "web testing" "baseline" Playwright`
- `"How Benchmarks Mis-Score Computer-Use Agents"`
- `"Anchor: Mitigating Artifact Drift in Agent Benchmark Generation"`
- `"Skill Induction for Code Agents on Web Automation"`

The new searches surfaced the Anchor/ERP-Bench two-harness comparison and the oracle-audit paper, but no paper satisfying all four full-conflict criteria above. Search-engine results were treated as discovery only; the recorded conclusions above are based on the linked paper/abstract/full-text excerpts, not snippets or vendor blogs.

## 5. Frozen scope

### Frozen estimand

Estimate **conditional differences among three Web UI testing approaches** on matched end-to-end test intents, with interactions by oracle authority/type and UI condition (clean, seeded functional fault, behavior-preserving evolution). The paper is about software testing, not generic browser automation, RPA, or agent capability ranking.

### Frozen arms

1. **A — Pure-visual CUA:** screenshots plus coordinate/keyboard/scroll actions; no DOM, accessibility tree, selectors, hidden state, or network/application data.
2. **B — Hybrid visual + structured-page agent:** screenshots plus declared DOM/accessibility representation; no hidden gold assertions or mutation labels.
3. **C — Accessibility-locator Playwright:** human-authored deterministic suite using role/label/text and justified stable test IDs; no runtime LLM adaptation and no intentionally brittle XPath/CSS strawman.

An agent-authored deterministic Playwright arm remains exploratory only and cannot displace the three confirmatory arms without a new scope decision.

### Frozen research questions

- **RQ1 (effectiveness):** Under matched intents and clean/seeded-fault Web application versions, how do the three arms differ in valid test completion and independently scored functional verdict accuracy?
- **RQ2 (oracle):** How do differences vary by oracle authority/type (visible UI, hidden persisted state, relational/cross-state, and exploratory visual/usability oracle)?
- **RQ3 (evolution and repair):** Under behavior-preserving DOM, accessibility-semantic, visual/layout, and interaction/runtime evolution, how do failure probability and repair effort differ?
- **RQ4 (operations):** How do authoring/repair effort, cost, latency, action/token volume, and run-to-run stability differ, and which task/UI conditions explain the trade-offs?

RQ4 is confirmatory for prespecified secondary outcomes but must not be reduced to a universal winner claim.

### Frozen outcomes

Primary outcomes are intentionally limited to:

1. Functional verdict balanced accuracy against known clean/faulty ground truth.
2. Independently scored valid test completion.
3. Active repair effort after behavior-preserving UI evolution.

Secondary outcomes: false-positive/false-negative rates, cost, wall-clock latency, authoring time, tokens/actions, retries, repeated-run failure probability, verdict disagreement, and failure categories. Every outcome must report denominators and distinguish infrastructure/evaluator errors from method failures.

### Frozen oracle rule

No arm's own verdict is ground truth. Hidden state assertions, database/API checks, and predeclared cross-state relations are the authority for functional outcomes. Visual/usability outcomes require a blinded double-rater rubric and remain exploratory unless the preregistered reliability threshold is met. This rule is mandatory given the oracle errors documented by `How Benchmarks Mis-Score Computer-Use Agents`.

## 6. Residual risks and mitigations

1. **Search incompleteness and rapid publication drift.** The audit is current only through 2026-08-15 and could miss an unindexed paper or a newly posted manuscript. Before submission, rerun ACM/IEEE/Scopus/Web of Science/Semantic Scholar searches and record the date; do not use “first” without the updated boundary.
2. **Paradigm overlap with Anchor/ERP-Bench.** A reviewer may argue that CUA-versus-Playwright comparison is no longer novel. Emphasize the testing estimand: injected faults, test-oracle correctness, behavior-preserving UI evolution, repair, and reliability, not enterprise-task pass rates.
3. **Model/harness confounding.** CUA and hybrid arms may use different model APIs or tool schemas. Freeze model/provider/version, log observations/actions, and report arm-level versus model-level effects; replicate one model where budget permits.
4. **Pure-visual leakage.** Browser wrappers can accidentally expose DOM or accessibility metadata. Add an observation-contract test and inspect serialized prompts/tool responses before any confirmatory run.
5. **Oracle circularity.** A Playwright evaluator can become a hidden execution baseline or share implementation bugs with Arm C. Isolate the evaluator process, use read-only DB/API checks, and cross-validate with an independently generated gold assertion.
6. **Task/app overlap with WebTestPilot/WebTestBench.** Reuse only after license and contamination checks; include at least three non-overlapping applications and disclose any reused benchmark tasks as replication strata.
7. **Repair-effort measurement bias.** Prompt/policy edits and code/locator edits are not identical labor. Predefine maintainer training, time cap, edit boundaries, censoring, and report person-minutes together with repair success.
8. **Underpowered interactions.** The arm × evolution × oracle factorial can grow rapidly. Use pilot-based simulation and a two-tier repetition design; reduce cells using preregistered strata rather than post-hoc favorable-task selection.
9. **Usability-label subjectivity.** Visual defects are not interchangeable with functional faults. Keep them separate, blind raters, and report inter-rater agreement and disagreement cases.

## 7. Gate decision

**GO, with a narrowed claim.** Proceed to Stage 2 feasibility audit and vertical-slice implementation. The collision gate passes only for the specific three-arm, software-testing estimand described above; it does not authorize a generic “CUA beats Playwright” claim.

## 8. Sources and project files consulted

The expanded targeted-search matrix and second-order snowball conclusions are recorded in [`research/phase1-expanded-search-2026-08-15.md`](phase1-expanded-search-2026-08-15.md). That addendum adds Leotta et al.'s three-way Web automation comparison, locator-evolution/repair benchmarks, BEWT, recent automated Web GUI testing studies, Web-form generation, and accessibility/replay neighbors. It does not reopen the frozen estimand; it strengthens the GO decision while narrowing the novelty claim.

- `research/SUMMARY.md`
- `research/deep-read-notes.md`
- `research/papers-reviewed.json`
- `research/citation-graph.json`
- `research/screening-ledger.csv`
- `research/venue-window-2026-08-15.md`
- `research/PROJECT_EXECUTION_PLAN.md`
- `research/PREREGISTRATION_DRAFT.md`
