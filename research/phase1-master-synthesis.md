# Phase 1 master synthesis — research boundary, purpose, and design freeze

**Project:** PSS-WebTest — *Pixels, Page Structure, or Scripts?*  
**Synthesis date:** 2026-08-15  
**Evidence boundary:** public scholarly papers and artifacts verified through DOI, publisher, arXiv/OpenReview, or official repositories by the date above  
**Decision:** **GO with a bounded contribution; do not make an unconditional “first” or universal-winner claim**  
**Data status:** no pilot or confirmatory data collected

## 1. Frozen research identity

### Working title

> **Pixels, Page Structure, or Scripts? A Controlled Empirical Study of Web UI Testing under Faults and Interface Evolution**

### One-sentence research question

> Under matched Web UI test intents, how do screenshot-only computer-use agents, hybrid visual-plus-structured-page agents, and production-quality accessibility-locator Playwright suites differ in end-to-end verdict correctness, valid completion, repair burden, cost, latency, and repeated-run stability across functional faults and behavior-preserving interface evolution?

### What the study is

- A controlled empirical comparison of three **deployment strategies** for Web UI testing.
- A study of conditional trade-offs, failure boundaries, and decision rules.
- A benchmark/evaluation contribution built around matched intents, independent oracle authority, controlled evolution, immutable traces, and repeated runs.

### What the study is not

- Not a generic comparison of CUA and Playwright for browser automation.
- Not another proposal for an autonomous test agent whose only contribution is natural-language execution.
- Not a locator-only robustness study.
- Not a ranking of model vendors.
- Not evidence that one approach universally replaces the others.

## 2. Collision decision

A **full direct conflict** must simultaneously satisfy all four criteria:

1. Web software/regression testing rather than generic navigation, RPA, or enterprise task completion.
2. At least one screenshot-only CUA arm and one human-authored deterministic browser-test-suite arm.
3. Matched test intents and equivalent/resettable initial application states.
4. Independently checkable testing outcomes rather than agent self-report or task completion alone.

No verified study satisfies all four. The project remains **GO**. However, several bodies of work remove broad novelty claims:

- Anchor/ERP-Bench and Průcha et al. already compare CUA-like execution with conventional automation outside software testing.
- WebTestPilot already combines Web testing, visual+DOM perception, inferred oracles, injected bugs, and a narrow Playwright locator comparison.
- Classical Web-testing research already compares visual versus DOM locators, capture/replay versus programmable testing, and visual repair.
- Recent Web-agent research already runs matched screenshot-versus-structure probes.

The defensible novelty is the **joint testing-specific design**: three whole-workflow approaches, matched intents, independent oracles, functional faults, behavior-preserving evolution, active repair, and stochastic operational outcomes.

## 3. Literature map and consequences

### Cluster A — autonomous Web testing and direct system neighbors

| Work | What it already establishes | Boundary for PSS-WebTest |
|---|---|---|
| Chevrot et al., *Are Autonomous Web Agents Good Testers?* ([DOI](https://doi.org/10.1145/3728879)) | 113 natural-language test cases over three offline Web apps; separates execution, assertions, and verdicts | We must separate valid execution from verdict correctness; it has no conventional suite arm |
| WebTestPilot ([DOI](https://doi.org/10.1145/3797115); [code](https://github.com/code-philia/WebTestPilot)) | Hybrid screenshot+DOM NL-to-E2E testing, inferred symbolic oracles, injected bugs, small Playwright/XPath/CSS re-identification comparison | Partial direct collision; our contribution cannot be oracle inference, visual grounding, or locator robustness alone |
| WebTestBench ([paper](https://arxiv.org/abs/2603.25226); [code](https://github.com/friedrichor/WebTestBench)) | CUA benchmark for checklist generation and defect detection | Candidate task/evaluator reference; lacks a human-authored script baseline and matched three-arm design |
| Salva, *Reliable execution of natural language test cases* ([DOI](https://doi.org/10.1007/s11219-026-09767-2)) | Guarded agent execution and false-positive/false-negative vocabulary | Reuse reliability decomposition; no screenshot-versus-script experiment |
| Liu et al., *Understanding Automated Web GUI Testing* ([paper](https://arxiv.org/abs/2606.16650)) | Compares model-based, RL, and LLM exploration/state abstractions | Broad empirical neighbor, not a matched CUA-versus-authored-suite study |
| *Practical Limits of Autonomous Test Repair* ([paper](https://arxiv.org/abs/2605.01471)) | Playwright-based multi-agent repair case study; exposes assertion weakening and test deletion as superficial convergence | Repair success must preserve oracle semantics; “green after repair” is insufficient |

### Cluster B — classical Web-test automation comparisons

| Work | What it already establishes | Boundary for PSS-WebTest |
|---|---|---|
| Leotta et al., capture/replay vs programmable testing ([DOI](https://doi.org/10.1109/WCRE.2013.6671302)) | Matched empirical comparison of development and evolution cost | Our cost/maintenance comparison has a strong classical predecessor |
| Leotta et al., visual vs DOM locators ([DOI](https://doi.org/10.1007/978-3-319-08245-5_19)) | Empirical visual-versus-DOM locator robustness and cost/benefit study | We cannot claim the first visual-versus-DOM Web-testing comparison; CUA autonomy and oracle reasoning are the distinction |
| Leotta et al., *Approaches and Tools for Automated E2E Web Testing* ([DOI](https://doi.org/10.1016/bs.adcom.2015.11.007)) | Separates test-development mode from locator mode: coordinate, DOM, visual, and hybrid combinations | Motivates a two-axis taxonomy rather than labeling every pixel method “CUA” |
| PESTO ([DOI](https://doi.org/10.1002/stvr.1665)) | Migrates DOM-based Selenium suites to visual-image-recognition suites | Generated visual scripts are not screenshot-only autonomous agents; keep them conceptually distinct |
| Leotta et al., NLP/programmatic/capture-and-replay comparison ([DOI](https://doi.org/10.1002/smr.2606)) | Nine suites, nine open-source apps, three testers; development and evolution effort | Strongest methodological collision; our study adds CUA runtime behavior, oracle correctness, controlled mutations, and stochasticity |
| Moń & Pańczyk, Playwright/Cypress/Selenium ([DOI](https://doi.org/10.35784/jcsi.7119)) | Conventional-tool timing/resource comparison | Operational baseline only, not an agent or oracle comparison |

### Cluster C — UI evolution, locator robustness, and repair

| Work | What it already establishes | Boundary for PSS-WebTest |
|---|---|---|
| VISTA, *Visual Web Test Repair* ([DOI](https://doi.org/10.1145/3236024.3236063); [code](https://github.com/saltlab/vista)) | Computer-vision-assisted Selenium repair on thousands of tests and many releases | CUA repair must be compared against established visual/DOM repair concepts, not only brittle XPath |
| Imtiaz et al., model-based repair ([DOI](https://doi.org/10.1016/j.jss.2020.110841)) | Repairs Capture/Replay scripts; validates DOM coverage and fault-finding after repair | Post-repair semantic preservation and fault-finding must be checked |
| Semantic Test Repair ([DOI](https://doi.org/10.1145/3611643.3616324)) | Semantic element matching for Web test repair | Locator repair is a mature comparison domain, not our main novelty |
| Xu, Li & Tan, LLM-enhanced Web UI repair ([DOI](https://doi.org/10.1109/ICST62969.2025.10989008)) | ChatGPT augments WATER/VISTA-style candidate matching with explanation validation | We must distinguish runtime autonomous testing from LLM-assisted repair of deterministic tests |
| Kluge & Stocco, relocalization replication/extension ([DOI](https://doi.org/10.1007/s10664-026-10903-6)) | Public 30-app, >10k-pair evolution benchmark and Selenium library | Strong benchmark-design precedent; it does not execute whole tests or evaluate oracle correctness |
| EAGL ([DOI](https://doi.org/10.1145/3818665)) | Evolution-aware robust locator generation | Main Playwright baseline must use modern locator practice, not intentionally weak selectors |

### Cluster D — oracle quality, fault revelation, and evidence admission

| Work | What it already establishes | Boundary for PSS-WebTest |
|---|---|---|
| MUTTA ([DOI](https://doi.org/10.1007/s11219-023-09616-6)) | E2E Web mutation pipeline; compares classical assertions and differential testing over large numbers of test executions | Prime reference for seeded-fault construction and test-suite fault-revelation measurement |
| LLM test-oracle authority SLR ([paper](https://arxiv.org/abs/2607.05031)) | Oracle authority is distinct from oracle implementation mechanism | Every task must name the authority that makes its verdict true or false |
| *How Benchmarks Mis-Score Computer-Use Agents* ([paper](https://arxiv.org/abs/2607.28367)) | Audits evaluator false negatives and broken tasks in CUA benchmarks | Require evaluator tests, broken-task status, trace evidence, and human audit samples |
| WebArena Verified ([paper](https://openreview.net/forum?id=94tlGxmqkN); [code](https://github.com/ServiceNow/webarena-verified)) | Audited tasks, typed comparators, backend/network verification, revisions and checksums | Reuse structured statuses, evaluator versioning, backend-state checks, and offline reevaluation |
| Anchor/ERP-Bench ([paper](https://arxiv.org/abs/2605.26321)) | Common verifier, fresh state, repeated pixel-CUA versus accessibility-resolved browser harness | Nearest matched-paradigm precedent, but not software testing |
| *An Executable Benchmarking Suite for Tool-Using Agents* ([paper](https://arxiv.org/abs/2605.11030)) | Separates workload, driver, and admitted evidence; records replay, cost, verifier and provenance | Adopt an explicit evidence-admission contract before confirmatory runs |

### Cluster E — screenshot, DOM, accessibility-tree, and hybrid Web agents

| Work | What it already establishes | Boundary for PSS-WebTest |
|---|---|---|
| WebVoyager ([paper](https://arxiv.org/abs/2401.13919)) and VisualWebArena ([paper](https://arxiv.org/abs/2401.13649)) | Visual information can be necessary for realistic navigation tasks | Navigation success is not defect detection or test-oracle correctness |
| BrowserGym ([paper](https://arxiv.org/abs/2412.05467); [code](https://github.com/ServiceNow/BrowserGym)) | Unified observation/action spaces, benchmark adapters, trace management | Strong harness reference; its benchmarks are not automatically valid testing SUTs |
| UIExplorer ([paper](https://arxiv.org/abs/2506.17779)) | Matched Structured and Screen exploration modes in a standardized GitLab environment | Direct modality precedent outside defect-oriented testing |
| ST-WebAgentBench ([paper](https://arxiv.org/abs/2410.06703); [code](https://github.com/segev-shlomov/ST-WebAgentBench)) | 80 matched modality-challenge tasks split into screenshot-advantage and AXTree/DOM-advantage cases | Use as a stress-test taxonomy; do not treat deliberately hidden information as ecological UI evolution |
| *Do GUI Agents Believe Their Eyes?* ([paper](https://arxiv.org/abs/2607.04334)) | Paired pixel/structure interventions over 310 probes and deterministic forced-choice scoring | Hybrid agents may copy structured text even when pixels disagree; add a modality-conflict diagnostic outside the primary effectiveness analysis |

### Cluster F — code generation and hybrid deployment alternatives

| Work | What it already establishes | Boundary for PSS-WebTest |
|---|---|---|
| XTestGen ([DOI](https://doi.org/10.1109/ICSME64153.2025.00104)) | NL-to-deterministic E2E scripts | Agent-authored deterministic Playwright is an important exploratory deployment strategy |
| AI-generated E2E scripts with ChatGPT/Copilot ([record](https://iris.unige.it/handle/11567/1220069)) | Compares manual and generated script authoring effort/quality | Generation-time assistance is different from runtime CUA testing |
| Peixoto et al., Gemini-generated Selenium tests ([DOI](https://doi.org/10.1109/AIware69974.2025.00012)) | Tests executability and fidelity to manual tasks over HTML from many pages | Supports script-generation baselines but not autonomous runtime or UI evolution |
| MacroBench ([paper](https://arxiv.org/abs/2510.04363)) | 681 tasks, seven self-hosted sites, Selenium program synthesis, DOM and database verification | Strong code-first benchmark precedent; no screenshot CUA and no authored suite comparison |
| SKILL.nb ([paper](https://arxiv.org/abs/2606.08049)) | Selectively converts agent workflows into validated code and measures re-execution/repair under drift | Shows the practical design space is a continuum; discuss hybridization rather than binary replacement |

### Cluster G — field context and external validity

- The 2026 systematic Web-testing survey analyzes 258 papers and reports that Selenium dominates while industrial/human studies and open tooling remain limited ([DOI](https://doi.org/10.1016/j.scico.2026.103473)).
- The Selenium practitioner survey reports assertability, asynchrony, and brittleness as major challenges and Playwright as the most prominent alternative ([DOI](https://doi.org/10.1016/j.infsof.2026.108077)).
- Repository mining of 472 open-source applications shows that Web GUI tests co-evolve with applications and require continuing maintenance ([DOI](https://doi.org/10.1016/j.infsof.2025.107928)).

These studies justify maintenance and operational outcomes, but they do not answer the causal three-arm question.

## 4. Refined conceptual framework

The literature shows that “visual versus traditional” collapses several independent dimensions. The study must name them explicitly:

| Dimension | Levels relevant to this study |
|---|---|
| Test artifact | Runtime agent trajectory; deterministic executable suite; agent-authored deterministic suite |
| Observation | Pixels only; pixels+DOM; pixels+AXTree; DOM/AXTree only |
| Action grounding | Coordinates/keyboard; indexed structured element; accessibility locator; selector/test ID |
| Oracle mechanism | Explicit assertion; agent-generated verdict; differential comparison; hidden evaluator |
| Oracle authority | Requirement/specification; clean/fault label; database/API state; cross-state relation; human visual rubric |
| Adaptation time | None; runtime replanning; post-failure repair; regeneration before next run |
| UI condition | Clean; functional fault; natural evolution; controlled behavior-preserving mutation; modality-adversarial stress probe |

The primary arms are therefore **bundled deployment treatments**. They answer “what happens if a team adopts this strategy?” They do not, by themselves, causally identify a pure modality effect.

To estimate modality more cleanly, add a small nested diagnostic in which the same model, prompt, action interface, budget, and task are run with screenshot-only versus screenshot+structured observation. This diagnostic is secondary and must not replace the three primary arms.

## 5. Frozen contribution and value proposition

### Scientific value

1. Connects classical empirical Web-testing research with modern CUA evaluation rather than treating agents as historically unprecedented.
2. Separates task execution, oracle correctness, and benchmark-evaluator correctness.
3. Measures UI evolution at whole-workflow level rather than only element relocalization.
4. Quantifies stochasticity and operational economics alongside testing effectiveness.
5. Produces conditional effect estimates and failure taxonomies instead of one aggregate leaderboard.

### Practical value

The intended output is a decision guide such as:

- stable, high-frequency, precisely specified flows → likely deterministic Playwright advantage;
- DOM churn with stable rendered semantics → possible pixel-agent or hybrid advantage;
- visual/layout change with stable accessible semantics → likely accessibility-locator advantage;
- canvas, chart, or visually encoded state → possible pure/hybrid visual advantage;
- hidden persisted or relational outcome → all arms require an external oracle;
- ambiguous or weakly specified intent → no approach should be declared correct without improving the specification.

These are hypotheses to test, not conclusions.

## 6. Frozen treatment definitions and fairness contract

### Arm A — screenshot-only CUA

- Input: intent, permitted credentials/preconditions, screenshots.
- Actions: coordinates, scrolling, keyboard, browser-visible navigation.
- Forbidden: DOM, accessibility tree, selectors, element IDs, network/database state, hidden mutation labels.

### Arm B — hybrid visual + structured-page agent

- Input: the same intent and screenshots plus a declared DOM/AXTree representation.
- Actions: the declared structured action interface; exact representation and grounding must be versioned.
- Forbidden: gold assertions, mutation labels, evaluator implementation, database/API truth.

### Arm C — production-quality accessibility-locator Playwright

- Human-authored deterministic test suite.
- Prefer `getByRole`, `getByLabel`, text, and justified stable test IDs.
- Explicit assertions; automatic waiting and standard Page Object/component abstractions allowed.
- Brittle XPath/CSS is not the default baseline.
- No runtime LLM adaptation.

### Matched-intent definition

“Matched” means identical user-level goal, preconditions, credentials, initial database snapshot, permitted information, success/failure semantics, and hidden evaluator. It does **not** require identical low-level click sequences; alternative valid paths are allowed.

### Fairness safeguards

- Same browser engine, viewport, locale, network policy, reset snapshot, timeout policy, and credential scope.
- Arm A/B use the same model/version and sampling policy wherever technically possible.
- Every run records the full observation/action contract to detect leakage.
- Resource budgets are reported, not artificially equalized when doing so would make a treatment unrealistic; a separate fixed-budget sensitivity analysis may be added.
- Pilot-tuned prompts and tests are frozen before confirmatory collection.

## 7. Frozen research questions

- **RQ1 — End-to-end correctness:** How do the three approaches differ in valid completion and correct clean/fault verdicts under matched intents?
- **RQ2 — Oracle boundary:** How do effects vary across visible-state, persisted-state, relational/cross-state, and visual/usability oracle authorities?
- **RQ3 — Evolution and repair:** How do failure probability, semantic preservation, repair success, and active repair effort change under behavior-preserving UI evolution?
- **RQ4 — Operations and stability:** How do authoring effort, monetary cost, latency, action/token volume, retry behavior, and run-to-run stability differ?
- **RQ5 — Decision boundary:** Which prespecified task, UI, oracle, and evolution characteristics predict relative advantage without claiming a universal winner?

RQ5 should remain exploratory unless a held-out validation design is frozen before confirmatory runs.

## 8. Benchmark construction framework

### Build-versus-reuse decision

No existing benchmark is adopted wholesale as the confirmatory benchmark because none jointly supplies software-test intents, clean/fault pairs, ecological UI evolution, independent oracle authority, repair tasks, and the three required arms. The preferred strategy is **reuse infrastructure and taxonomies, build the matched testing layer**:

- BrowserGym/AgentLab concepts for normalized observation/action adapters and trace collection;
- WebArena Verified for evaluator statuses, backend/network evidence, revisions, checksums, and offline rescoring;
- MUTTA for the mutation/deploy/run/collect pipeline pattern;
- VISTA, Kluge–Stocco, EAGL, and classical visual/DOM studies for evolution and repair taxonomies;
- WebTestPilot, Chevrot, and WebTestBench for task/oracle/failure decompositions;
- ST-WebAgentBench and *Do GUI Agents Believe Their Eyes?* for a separate modality diagnostic.

The implementation should remain a thin, locally controlled harness rather than inheriting a multi-service benchmark stack whose reset and evaluator semantics cannot be fully audited within the project window.

### Application selection

- Target four self-hosted, resettable, legally usable applications from distinct domains/UI stacks.
- At least one application may overlap a prior benchmark for comparability; at least three should be non-overlapping to reduce contamination.
- Require deterministic seed/reset, version pinning, independent API/database oracle access, and at least four nontrivial workflows.
- Exclude CAPTCHA, uncontrolled third parties, irreversible transactions, personal data, and tasks without a stable authority.

### Task selection

Use 4–6 workflows per application, stratified across CRUD, forms/validation, search/filter, role/permission, cross-page state, and data-dependent flows. Each task must define:

- versioned intent and allowed information;
- precondition and reset fixture;
- valid alternative paths;
- visible checkpoints;
- hidden success/failure assertions;
- timeout and broken-task criteria;
- oracle authority and mechanism;
- mutation/evolution applicability.

### Two evolution strata

1. **Ecological evolution:** real version changes or realistic refactors, sampled without deliberately hiding information from one modality.
2. **Mechanism stress tests:** controlled screenshot-advantage/structure-advantage mutations inspired by ST-WebAgentBench and visual/DOM literature.

Do not pool these strata. The first supports practical claims; the second explains mechanisms.

### Functional fault families

- wrong state transition;
- incorrect persisted value;
- missing/incorrect input validation;
- authorization/role violation;
- cross-page inconsistency;
- misleading success/failure feedback.

Mutation operators must be piloted for realism and non-equivalence. MUTTA is a reference implementation pattern, not automatically the final operator set.

### Behavior-preserving evolution families

- DOM refactor with stable appearance and a11y semantics;
- a11y name/role/grouping evolution with preserved user-level intent;
- visual/layout/theme/responsive evolution with stable semantics;
- interaction/runtime changes such as delay, overlay, animation, or recoverable network disturbance;
- flow restructuring with unchanged final business effect.

Every evolution must pass an independent invariant suite before admission. A mutation that changes intended behavior belongs in the functional-fault stratum.

## 9. Oracle and evaluator architecture

No arm's own verdict is ground truth. Each task declares:

- **Authority:** specification, known clean/fault variant, database/API state, relational invariant, or blinded human rubric.
- **Mechanism:** typed value comparator, state query, relation checker, network trace, visual rubric, or differential comparison.

Required safeguards:

- Separate valid execution, verdict coverage, conditional verdict accuracy, and joint end-to-end correctness.
- Use typed/normalized comparators and backend state for state-changing tasks where possible.
- Store evaluator version, data version, checksums, raw expected/actual values, and explicit `success`, `failure`, `partial`, `broken_task`, and `evaluator_error` states.
- Unit-test every evaluator against valid alternative trajectories and known negative cases.
- Manually audit a blinded sample of both PASS and FAIL decisions.
- Keep visual/usability outcomes exploratory unless inter-rater reliability crosses a preregistered threshold.

## 10. Outcome hierarchy

### Confirmatory primary outcomes

1. **Joint end-to-end verdict correctness:** the intended checkpoint was validly reached and the final clean/fault verdict is correct.
2. **Valid test completion:** independently verified completion of required state/checkpoints, irrespective of the arm's self-report.
3. **Repair outcome:** repair success with preserved oracle semantics, analyzed jointly with active person-time and censoring.

Balanced accuracy, sensitivity, specificity, false-positive and false-negative rates are reported for the clean/fault design. Verdict accuracy must always be paired with verdict coverage.

### Secondary outcomes

- authoring and repair person-minutes;
- wall-clock latency and timeout rate;
- model/API cost;
- tokens, screenshots, actions, retries, and observation bytes;
- repeated-run pass probability and verdict disagreement;
- infrastructure/evaluator failure rate;
- failure taxonomy: perception, grounding, planning, execution, verification/oracle, environment, and task defect.

Do not compare raw lines-of-code with prompt edits as if they were the same labor unit. Use person-time, repair success, edit category, and post-repair validation together.

## 11. Experimental design and identification

- Unit: application × task × version/condition × arm × independent run.
- Blocking: application × task × condition; randomize arm order within blocks and counterbalance over time.
- Broad tier: all admitted cells with at least three runs per arm, including deterministic Arm C to estimate environment flakiness.
- Reliability tier: preregistered stratified subset with at least ten additional runs per agent arm and enough Arm C repeats to characterize harness noise.
- Pilot tasks/apps used for prompt, mutation, or evaluator tuning are excluded from confirmatory analysis unless an untouched holdout is defined.
- Repair trigger and censoring rules are frozen before confirmatory runs.
- No early stopping based on apparent arm superiority.

Primary models should estimate marginal risk differences with uncertainty using mixed-effects models, application/task effects, prespecified arm×condition and arm×oracle interactions, and Holm correction across primary outcome families. Repair time requires a survival or prespecified two-part model because unsuccessful repairs are censored, not zero-time observations.

## 12. Key threats and mandatory controls

| Threat | Required control |
|---|---|
| Treatment-bundle confounding | State explicitly that A/B/C are deployment strategies; use a nested modality diagnostic for mechanism claims |
| Model/provider confounding | Same model/version for A/B where possible; record immutable IDs and run a limited replication if budget permits |
| Pure-visual leakage | Automated observation-contract tests and stored serialized model inputs |
| Strawman Playwright | Use role/label/text/test-ID hierarchy, auto-waits, reusable abstractions, and experienced review |
| Oracle circularity | Evaluator isolated from all arms; hidden backend/API assertions; independent tests of evaluator code |
| Synthetic mutation bias | Separate ecological evolution from modality-adversarial stress tests |
| Agent contamination | Prefer new applications/tasks, disclose overlap, and separate reused benchmark strata |
| Repair by weakening assertions | Freeze oracle semantics; diff assertions; rerun known positive and negative controls after repair |
| Researcher skill bias | Standardized training, crossover/counterbalancing, or multiple implementers; preserve raw time logs |
| Benchmark drift | Pin versions, freeze task/evaluator manifests, record hashes, and rerun collision search before submission |
| Outcome selection | Three primary outcomes and formulas preregistered before confirmatory runs |

## 13. Claims the paper may and may not make

### Potentially defensible after successful execution

- “We conduct a controlled, matched comparison of three Web UI testing deployment strategies under independently verified faults and behavior-preserving UI evolution.”
- “We estimate conditional effectiveness, repair, cost, latency, and stability trade-offs.”
- “We release a versioned benchmark and evidence-admission pipeline enabling independent reevaluation.”

### Prohibited without a new exhaustive update

- “The first comparison of CUA and Playwright.”
- “The first visual-versus-DOM Web-testing study.”
- “CUA replaces traditional testing.”
- “Agents require less maintenance” based only on locator recovery or one successful rerun.
- “Correct test” based on the agent's own verdict or a single brittle checker.
- “UI evolution robustness” based only on adversarial hidden-information probes.

## 14. Phase 1 exit gate and remaining decisions

### Verification limits and explicit unknowns

- The search is broad and snowball-driven but is not yet an exported PRISMA review from ACM DL, IEEE Xplore, Scopus, and Web of Science. Absence claims remain search-bounded.
- The Web connector blocked direct Semantic Scholar graph-API retrieval in this round; manual forward/backward queries and the previously saved citation graph were used instead.
- Several 2026 items are arXiv preprints or workshop papers. Their peer-review status, final pagination, and artifact versions must be rechecked before submission.
- Open/runability status is not inferred from a paper saying “we release.” MacroBench, UIExplorer, *Do GUI Agents Believe Their Eyes?*, SKILL.nb, and *Practical Limits of Autonomous Test Repair* still require repository, license, dependency, reset, and result-reproduction audits before reuse.
- The Healenium comparison is retained only as `possibly-relevant`: the accessible article reports large improvements, but experimental provenance and independent reproducibility are not yet strong enough for it to anchor a claim.
- Commercial NLP-testing tools in Leotta et al. are evidence about an approach class, not automatically reproducible candidates for this project.

### Frozen and ready for preregistration drafting

- Testing-specific estimand and bounded novelty claim.
- Three primary deployment arms and prohibited-information contracts.
- RQ1–RQ4 confirmatory; RQ5 exploratory unless held-out validation is frozen.
- Independent oracle-authority rule.
- Separation of functional faults, ecological evolution, and modality stress tests.
- Primary outcome families and evidence-admission principles.

### Must be resolved in Phase 2/pilot before registration

- Final SUTs, versions, licenses, and deterministic reset evidence.
- Exact CUA/hybrid implementation and B-arm action interface.
- Task, fault, and evolution manifests.
- Implementer/maintainer design and repair time cap.
- Minimum effects of practical interest and simulation-based sample size.
- Budget ceiling, repetition allocation, model-replication policy, and infrastructure-error adjudication.
- Rater statistic/threshold for visual-usability outcomes.

## 15. Priority reading order

### Tier 1 — must be cited in the problem statement and design

WebTestPilot; Chevrot et al.; WebTestBench; Leotta visual-vs-DOM; Leotta NLP/programmatic/capture-replay; VISTA; MUTTA; Anchor/ERP-Bench; How Benchmarks Mis-Score CUA; WebArena Verified.

### Tier 2 — methods and boundary conditions

Kluge–Stocco relocalization benchmark; Imtiaz model-based repair; ICST 2025 LLM-assisted repair; BrowserGym; UIExplorer; ST-WebAgentBench; Do GUI Agents Believe Their Eyes?; Practical Limits of Autonomous Test Repair; Executable Benchmarking Suite.

### Tier 3 — artifact and external-validity support

BEWT; MacroBench; VisualWebArena; XTestGen; AI-generated Selenium/E2E studies; Selenium survey; 258-paper Web-testing survey; 472-repository adoption/maintenance study.
