# Project execution plan: Computer Use versus traditional Web UI testing

## Material Passport

- Origin skills: `academic-research-suite` (Stage 1 planning), `experiment-agent` (plan mode), `aer-preregistration`
- Origin date: 2026-08-15
- Verification status: DESIGN DRAFT — no experiment has been run
- Version: 0.1
- Intended primary venue: IEEE TSE; future ISSTA/ASE CFPs should be monitored

## 1. Decision summary

### Current execution status (2026-08-15)

- **Phase 1 — scope/collision freeze:** GO with a narrowed testing-specific claim. The nearest newly identified paradigm precedent is Anchor/ERP-Bench, which compares pixel CUA and accessibility-resolved Playwright on enterprise workflows but does not evaluate software testing, seeded faults, UI evolution, repair, or test-suite oracles. See `phase1-collision-freeze.md`.
- **Phase 2 — feasibility audit:** candidate path identified but gate **not yet passed**. BookStack and Indico are the provisional vertical-slice SUTs; the current arm64 machine has no Docker/Compose executable, and the WebTestPilot bundle documents linux/amd64 images. See `phase2-feasibility-audit.md` and `sut-candidate-audit.csv`.
- No feasibility or agent trial is confirmatory evidence. The next action is to establish a reproducible container/runtime path and complete the BookStack + Indico reset/oracle smoke test.

The project should not ask whether Computer Use is universally “better” than traditional UI automation. It should estimate **conditional advantages and failure boundaries**:

> Under which Web UI, test-oracle, and UI-evolution conditions do pure-visual CUAs, hybrid visual-plus-structured-page agents, and accessibility-locator Playwright suites differ in defect detection, execution validity, repair effort, cost, latency, and run-to-run stability?

The defensible contribution is a controlled, whole-workflow comparison with matched test intents, independent ground truth, repeated stochastic trials, and a reusable mutation/evaluation harness. WebTestPilot is a partial collision, so this study must not claim novelty merely from natural-language Web testing, visual grounding, symbolic oracle inference, or isolated locator re-identification.

**Submission strategy:** build a complete three-month study for TSE rather than rushing an underpowered FSE 2027 submission. ISSTA 2027 and ASE 2027 remain future conference options after their official CFPs appear. NIER/tool/demo/AST are separate fallback products, not substitutes for a CCF-A full research paper.

## 2. Research questions and expected contribution

### RQ1 — Correctness

How do the three approaches differ in valid test execution and functional-defect verdict accuracy under matched test intents?

### RQ2 — Evolution robustness

How do they degrade, recover, and require repair under controlled, behavior-preserving UI evolution?

### RQ3 — Operational characteristics

How do monetary cost, wall-clock latency, authoring/repair effort, and repeated-run instability differ?

### RQ4 — Boundary conditions

Which task, UI, oracle, and evolution characteristics explain when each approach is preferable?

Expected research artifacts:

1. A preregistered comparison protocol and explicit oracle-authority taxonomy.
2. A versioned benchmark of matched test intents, clean versions, behavior-preserving UI evolutions, and seeded functional faults.
3. A common runner and independent scoring layer for all three arms.
4. Effect estimates with uncertainty and interaction analyses, not only aggregate leaderboards.
5. A practical decision guide mapping application conditions to an appropriate testing approach.

## 3. Experimental arms

| Arm | Observation and action contract | What is deliberately excluded |
|---|---|---|
| A: Pure-visual CUA | Receives screenshots plus natural-language test intent; acts through coordinates, scrolling, keyboard, and browser-visible state. | DOM, accessibility tree, selectors, hidden network/application state. |
| B: Hybrid visual + structured-page agent | Receives the same intent and screenshot plus a declared DOM/accessibility representation; may ground actions through structured elements. | Hidden gold assertions, database state, mutation labels. |
| C: Accessibility-locator Playwright | Human-authored deterministic suite using role, label, text, test-id only when justified, and explicit assertions. | XPath/CSS as the default strategy; runtime LLM adaptation. |

An optional “agent authors a deterministic Playwright test” arm is scientifically interesting but is **exploratory only** unless the pilot shows sufficient time and budget. Adding it must not reduce replication of the three confirmatory arms.

### Fairness rules

- Every arm implements the same versioned natural-language test intent and receives the same permitted task information.
- Browser engine, viewport, locale, initial database snapshot, credentials, network policy, and timeouts are identical.
- Prompts, model identifiers, tool schemas, action budgets, temperatures, and retry policy are frozen before confirmatory runs.
- Arm A must be instrumented to prove that no DOM/accessibility data leak into its context.
- Arm C is a production-quality baseline, not a deliberately brittle CSS/XPath strawman.
- Authoring time and repair time are recorded separately from execution time.

## 4. Systems, tasks, and experimental conditions

### Initial scope target

- Four self-hosted, open-source Web applications from distinct domains and UI styles.
- Six end-to-end workflows per application (24 matched test intents).
- Include CRUD, multi-step form, search/filter, role/permission, cross-page state, and data-dependent workflows.
- Prefer one application overlapping prior work for comparability and three non-overlapping applications for external validity.

This is a planning target, not a frozen sample. Final sample size and repetitions must be chosen by simulation-based power analysis using pilot estimates and the actual API budget.

### Study A: functional defect detection

Each task has a known-clean version and seeded functional faults. Fault families should include wrong state transition, incorrect persisted value, missing/incorrect validation, authorization violation, and cross-page inconsistency. The fault seed and expected state are hidden from all testing arms.

### Study B: behavior-preserving UI evolution

UI changes must preserve intended functionality and be independently verified before use:

1. **DOM refactor:** nesting, IDs, classes, or component structure change while rendered meaning and accessibility semantics remain stable.
2. **Accessibility-semantic evolution:** visible wording, accessible name, role, or grouping changes while the user-level intent remains achievable.
3. **Visual/layout evolution:** reorder, spacing, theme, responsive arrangement, or component replacement changes pixels while semantics remain stable.
4. **Interaction/runtime disruption:** overlay, delayed loading, animation, transient notification, or recoverable network delay.

Functional faults and behavior-preserving evolution are analyzed separately. A changed UI is not automatically a bug.

### Oracle strata

| Oracle stratum | Test intent example | Independent authority |
|---|---|---|
| Visible UI state | Confirmation, validation message, table row | Instrumented UI state plus application assertion |
| Persisted hidden state | Record was stored correctly | Database/API assertion unavailable to the test arm |
| Relational/cross-state | Total, permission, or value remains consistent across pages | Gold relation over database/API and UI snapshots |
| Visual/usability | Occlusion, truncation, alignment, misleading feedback | Double-blind human rubric; exploratory unless reliability is adequate |

## 5. Outcome hierarchy

To prevent outcome shopping, only three measures are confirmatory primary outcomes:

1. **Functional verdict balanced accuracy:** correct pass/fail verdict against known clean/faulty ground truth, retaining false-positive and false-negative rates.
2. **Valid test completion rate:** the intended preconditions, actions, and checkpoint were actually reached, scored independently from the arm's self-report.
3. **Repair effort:** active person-minutes required to restore a failing test approach after behavior-preserving UI evolution, with censoring rules for unsuccessful repair.

Secondary outcomes are API/model cost, wall-clock latency, authoring effort, token/action counts, run-to-run failure probability, verdict disagreement, and failure-mode distribution. These are important but must not all be promoted to primary outcomes after results are seen.

## 6. Independent scoring architecture

Each run produces an immutable record containing:

- application, version, task, arm, model/tool version, run seed, and timestamp;
- permitted observations and full action trajectory;
- whether the intended checkpoint was reached;
- emitted verdict and confidence, if any;
- hidden application/database assertions evaluated after the arm stops;
- wall time, action count, retries, tokens, and monetary cost;
- failure category and trace/artifact hashes.

The evaluator, not the agent or test script, assigns the ground-truth outcome. Execution validity and verdict accuracy are separate. Human adjudicators are blinded to the arm for visual/usability judgments; two raters independently label a calibration subset, and the stratum remains exploratory if inter-rater reliability is inadequate.

### Repair-study trigger

A behavior-preserving evolution enters the repair study only when an arm succeeds in at least two of three baseline verification runs but fails in at least two of three evolved-UI runs. A maintainer then receives the same failure trace format, a fixed time budget, and arm-specific permitted edits: prompts/policies for agent arms and test code/locators for Playwright. Active work time, unsuccessful timeout, edit size, and three fresh post-repair validation runs are recorded. The exact threshold and time budget remain subject to pilot validation and preregistration.

## 7. Repetition and sampling strategy

Use a two-tier design to keep the study affordable while estimating stochasticity:

- **Broad comparison:** all eligible task-condition cells, with at least three independent runs per arm.
- **Reliability substudy:** a preregistered stratified subset spanning applications, oracle types, and mutation families, with at least ten additional independent runs per arm.

The final counts are selected after the pilot by simulation-based power analysis for the primary interaction effects. The same retry definition applies to all arms; an automatic retry is not silently converted into a successful run.

## 8. Statistical analysis plan

- Unit of observation: task × application version/condition × independent run.
- Binary outcomes: mixed-effects logistic regression with arm, oracle stratum, evolution/fault family, task complexity, and prespecified interactions as fixed effects; application and task as random intercepts.
- Repair time, latency, and cost: log-normal or Gamma mixed models selected from pilot diagnostics, supplemented by paired bootstrap confidence intervals.
- Stability: per-cell failure probability and between-run variance/disagreement; report the full distribution rather than only best-of-N success.
- Multiplicity: Holm correction across the three primary outcome families; secondary analyses labeled exploratory.
- Reporting: marginal effects, odds/risk differences, 95% confidence intervals, raw denominators, false-positive/false-negative rates, and failure taxonomy.
- Missing/censored runs: retain timeout, infrastructure error, model refusal, evaluator failure, and genuine test failure as distinct states. Do not collapse environment failure into approach failure.

The exact model formulas, exclusion rules, minimal detectable effects, and stopping rules must be frozen in `PREREGISTRATION_DRAFT.md` before confirmatory data collection.

## 9. Thirteen-week execution schedule

| Dates | Phase | Required output | Exit gate |
|---|---|---|---|
| Aug 15–21 | Scope and collision freeze | RQs, arm contracts, primary outcomes, updated conflict matrix | No newly found study already performs the same three-arm, whole-workflow comparison. |
| Aug 22–Sep 4 | Feasibility audit | Runnable candidates, license/security sheet, reset scripts, cost pilot | At least 3 candidate SUTs reset deterministically; all three arms complete representative workflows. |
| Sep 5–18 | Benchmark design | Task schema, oracle specs, mutation taxonomy, gold assertions | Each task has a machine-checkable external oracle; evolution mutations are behavior-preserving. |
| Sep 19–Oct 2 | Harness implementation | Common runner, adapters, immutable logs, cost/latency capture | Arm isolation tests pass; pure-visual arm has no structured-page leakage. |
| Oct 3–9 | Pilot and power simulation | Pilot dataset, failure taxonomy, budget forecast, simulated power | Sample/repetition plan is affordable and detects effects of practical interest. |
| Oct 10–12 | Protocol freeze | Timestamped preregistration, frozen task/mutation manifest, analysis scripts skeleton | Confirmatory protocol hash recorded; no outcome-informed redesign afterward. |
| Oct 13–30 | Confirmatory runs | Complete raw run ledger and artifact hashes | Prespecified completeness threshold met; deviations logged, not silently repaired. |
| Oct 31–Nov 6 | Analysis and robustness | Tables, plots, mixed-model outputs, sensitivity analyses | Independent reproduction of main tables from raw ledger succeeds. |
| Nov 7–15 | Paper and artifact release candidate | TSE manuscript, replication package, threat-to-validity audit | Claims trace to evidence; artifact runs from clean setup; internal review issues resolved. |

## 10. Go/no-go and pivot gates

1. **Collision gate:** if a newly verified paper already provides the same matched three-arm study and outcomes, pivot to a replication/extension focused on oracle authority, UI evolution, or cross-model generalization.
2. **Runability gate:** if fewer than three suitable applications can be reset offline and licensed for redistribution, reduce breadth and frame the work as a rigorous benchmark pilot; do not use uncontrolled public websites.
3. **Arm-validity gate:** if pure visual cannot be technically isolated from DOM/accessibility input, rename/redefine the arm before data collection.
4. **Budget gate:** if the reliability substudy exceeds the approved API budget, reduce task cells using preregistered stratified sampling, not by selecting favorable results.
5. **Oracle gate:** tasks without an independent ground-truth oracle are excluded from confirmatory effectiveness analysis and may remain qualitative/exploratory.
6. **Power gate:** if pilot variance implies infeasible power, narrow the estimand to fewer interactions rather than running an underpowered universal comparison.

## 11. Work products and repository layout

Planned additions:

```text
research/
  PROJECT_EXECUTION_PLAN.md
  PREREGISTRATION_DRAFT.md
  decision-log.md
  sut-candidate-audit.csv
  task-manifest.csv
  mutation-manifest.csv
code/
  src/arms/{visual,hybrid,playwright}/
  src/evaluator/
  src/reset/
  schemas/run-record.schema.json
  analysis/
artifacts/
  raw/ derived/ figures/ logs/
paper/
  main.tex references.bib
```

Raw outputs are append-only. Derived datasets and figures must be reproducible from scripts. API keys and participant/account data never enter the repository.

## 12. Immediate next actions

1. Audit 6–8 candidate self-hosted applications and the reusable artifacts from WebTestBench, Chevrot et al., BrowserGym, SeeAct, and WebTestPilot for license, reset determinism, platform compatibility, and task reuse.
2. Implement one vertical-slice task across all three arms and one independent evaluator assertion.
3. Add one behavior-preserving layout mutation and one seeded functional fault to that task.
4. Run a small cost/latency/reliability pilot; do not treat it as confirmatory evidence.
5. Use the pilot to finalize power, repetitions, budget, and task inclusion rules.
6. Freeze and timestamp the preregistration before collecting the confirmatory dataset.

### First seven-day backlog

- Day 1: create the SUT audit sheet and score candidate licenses, installation, reset, oracle access, and workflow diversity.
- Day 2: select two provisional SUTs and archive exact versions; document why rejected candidates failed.
- Day 3: specify one cross-page workflow with preconditions, action checkpoints, clean verdict, and hidden state assertion.
- Day 4: implement the Playwright baseline and evaluator; verify reset determinism over ten local repetitions.
- Day 5: connect the same intent to pure-visual and hybrid adapters with observation-contract logging.
- Day 6: add one layout evolution and one functional fault, then run non-confirmatory smoke trials.
- Day 7: review failures, cost, and leakage evidence; decide whether the selected arms/SUTs pass the first feasibility gate.
