# Preregistration and analysis protocol — draft v0.1

## Material Passport

- Origin skill: `aer-preregistration`, adapted for a software-engineering benchmark study
- Origin date: 2026-08-15
- Verification status: UNREGISTERED DRAFT
- Data status: no pilot or confirmatory data collected

This file is a protocol-development workspace. It is not a preregistration until all bracketed decisions are resolved, the pilot is separated from confirmatory data, and a timestamped public/private registration is created before confirmatory runs.

## A. Study identity

- Working title: *Pixels, Page Structure, or Scripts? A Controlled Empirical Study of Web UI Testing under Faults and Interface Evolution*
- Design: repeated, matched, multi-application controlled benchmark
- Arms: pure-visual CUA; hybrid visual + structured-page agent; accessibility-locator Playwright
- Target population: self-hosted Web applications and end-to-end workflows satisfying the eligibility criteria below

The three arms are treated as **bundled deployment strategies**. Their primary contrast does not by itself identify a pure observation-modality effect because observation, action grounding, runtime adaptation, and artifact type differ. A smaller nested modality diagnostic may compare screenshot-only with screenshot-plus-structure while holding model, prompt, action interface, and budget fixed; that diagnostic is secondary unless separately powered and preregistered.

## B. Confirmatory research questions

- RQ1: How does testing approach affect joint end-to-end verdict correctness and valid test completion?
- RQ2: How do those effects interact with oracle authority/type?
- RQ3: How does testing approach affect failure probability, semantic preservation, repair success, and active repair effort after behavior-preserving UI evolution?
- RQ4: How does testing approach affect authoring effort, monetary cost, latency, action/token volume, retries, and run-to-run stability?
- RQ5: Which prespecified task, UI, oracle, and evolution characteristics predict relative advantage?

RQ1–RQ3 define the confirmatory primary outcome families. RQ4 is confirmatory for prespecified secondary outcomes. RQ5 remains exploratory unless a held-out validation design and prediction rule are frozen here before confirmatory runs.

## C. Hypotheses to finalize before registration

- H1: Accessibility-locator Playwright will have higher baseline valid-completion and lower latency/variance than the two agent arms on stable interfaces.
- H2: Pure-visual CUA will degrade less than Playwright under DOM-only refactors but more under large visual/layout changes.
- H3: The hybrid agent will outperform the pure-visual arm on structured, multi-step, data-dependent workflows, but may inherit sensitivity to accessibility/DOM-semantic changes.
- H4: Agent arms will require less active repair after some UI evolutions but incur greater execution cost, latency, and run-to-run variability.

These are design hypotheses, not findings. Directional tests, equivalence margins, and practically meaningful effect sizes remain **TBD from domain justification and blinded pilot variance**, not from confirmatory outcomes.

## D. Eligibility and exclusion

### Application eligibility

- Open-source and legally redistributable for research, or reproducibly installable from an archived upstream version.
- Self-hosted/offline-capable; deterministic database reset and seeded accounts.
- Supports at least four nontrivial end-to-end workflows and an independent state oracle.
- No CAPTCHA, irreversible external transaction, uncontrolled third-party dependency, or required personal data.

### Task eligibility

- Has a versioned natural-language intent with explicit preconditions and success/failure semantics.
- Can be implemented in all three arms without giving one arm extra task knowledge.
- Has an external gold assertion not visible to either agent arm.
- Can be repeated after an automated state reset.

### Prespecified run exclusions

- Confirmed harness/evaluator defect affecting all arms; rerun only after a versioned deviation entry.
- Failed environment reset detected before the arm begins.
- Provider-wide outage documented independently of the task.

Timeouts, model refusals, browser crashes caused during the run, locator failures, and invalid actions are outcomes/failure modes, **not exclusions**. Exact infrastructure-error adjudication rules are TBD before registration.

## E. Assignment, ordering, and blinding

- Randomize run order within blocks of application × task × condition.
- Counterbalance arms over time to reduce provider/load and machine-temperature effects.
- Use independent reset snapshots and unique run identifiers.
- Evaluator assertions are hidden from testing arms.
- Human visual/usability raters receive randomized artifacts without arm labels.
- Analysts should generate the confirmatory table shells and model code before unblinding arm labels where practical.

## F. Primary outcomes

1. Joint end-to-end verdict correctness: the intended checkpoint is validly reached and the clean/fault verdict is correct. Report balanced accuracy, sensitivity, specificity, and verdict coverage over the clean/fault design.
2. Valid test completion (binary), independently scored from state/trace checkpoints.
3. Repair outcome after behavior-preserving UI evolution: success with preserved oracle semantics, analyzed jointly with active person-minutes and censoring for unsuccessful repair.

### Secondary outcomes

False-positive/false-negative rates; authoring effort; monetary cost; latency; tokens; action count; retries; repeated-run failure probability; verdict disagreement; censored repair rate; failure categories.

### Repair protocol to freeze

- Candidate trigger: succeeds in at least two of three baseline verification runs and fails in at least two of three evolved-UI runs.
- Maintainer input: identical failure-report fields across arms, with arm label necessarily visible because the edited artifact differs.
- Permitted edit: agent prompt/policy/configuration for Arms A/B; test code/locator/assertion for Arm C. The SUT, intent, evaluator, and gold oracle cannot be changed.
- Measurement: active person-minutes, number and size of edits, completion/censoring status, and three new validation runs.
- Exact repair time cap, maintainer assignment, learning/washout controls, and whether repeated tasks use a crossover design are TBD before registration.

### Outcome safeguards

- An absent verdict is not silently counted as a correct pass/fail.
- Report verdict coverage alongside conditional verdict accuracy.
- Do not condition the only effectiveness analysis on successful execution; provide joint end-to-end correctness and decomposed outcomes.
- Preserve environment/runtime error as a separate label backed by machine evidence.

## G. Experimental conditions

- Clean baseline.
- Seeded functional fault families: wrong state transition, persisted-data corruption, missing/incorrect validation, authorization violation, cross-page inconsistency.
- Ecological behavior-preserving evolution families: DOM refactor, accessibility-semantic evolution, visual/layout evolution, interaction/runtime disruption, and flow restructuring with unchanged business effect.
- Modality-mechanism stress tests: deliberately screenshot-advantage or structure-advantage probes. These are analyzed separately from ecological evolution and cannot support prevalence claims.
- Oracle strata: visible UI, hidden persisted state, relational/cross-state, visual/usability (exploratory unless rater reliability passes the frozen threshold).

The exact manifest, mutation implementations, and factorial/blocking scheme are TBD after feasibility audit and before registration.

## H. Sample size and repetitions

- Planning frame: four applications × six workflows = 24 test intents.
- Broad tier: at least three independent runs per eligible arm-condition cell.
- Reliability tier: at least ten additional runs on a stratified preregistered subset.
- Final sample: TBD by simulation-based power analysis using pilot variance/correlation and a justified minimum effect of practical interest.
- Pilot applications/tasks used to tune prompts, mutations, or scoring are marked and excluded from confirmatory analysis, unless a clean untouched holdout version is defined in advance.

## I. Frozen intervention details

Before registration, record:

- model/provider/version and API date or immutable identifier;
- system/task prompts and tool schemas;
- temperature/sampling parameters and random-seed behavior;
- maximum steps, timeout, retry policy, and context policy;
- screenshot resolution and browser/OS versions;
- DOM/accessibility representation available to the hybrid arm;
- action interface available to the hybrid arm, including whether structured references or coordinates are used;
- permitted Playwright locator hierarchy and assertion policy;
- repair operator instructions and stopping/censoring rule.

Any provider/model update during confirmatory runs triggers a documented protocol decision; versions are never pooled silently.

## J. Analysis specification

### Primary models

- Binary valid completion and verdict outcomes: mixed-effects logistic regression.
- Fixed terms: arm, condition family, oracle stratum, preregistered task-complexity covariates, and arm × condition plus arm × oracle interactions.
- Random intercepts: application and task; add random slopes only if the frozen model and data support stable estimation.
- Repair time: survival model with unsuccessful repair as right-censored, or a prespecified two-part model; final choice TBD from pilot diagnostics.
- Primary-family multiplicity: Holm adjustment over the three primary outcome families.

### Required reporting

- Raw counts and denominators.
- Marginal effects/risk differences and 95% confidence intervals.
- False-positive and false-negative rates.
- Model diagnostics, convergence status, and sensitivity analyses.
- Results with and without documented infrastructure errors, without relabeling those errors as successful tests.

### Robustness analyses

- Alternate reasonable link/distribution for time and cost.
- Application leave-one-out estimates.
- Per-oracle and per-evolution stratified estimates.
- Joint end-to-end correctness versus decomposed execution/verdict results.
- Model/provider replication, only if declared confirmatory before registration; otherwise exploratory.

## K. Stopping and deviation rules

- No early stopping for apparent superiority/inferiority.
- Stop for budget only at a prespecified run-block boundary; retain all completed blocks and report the decision.
- Stop for safety/provider terms changes or a systemic invalidating harness defect.
- Every deviation receives an ID, timestamp, reason, affected runs, and before/after protocol hash.
- Changes made after viewing confirmatory arm outcomes are labeled exploratory and cannot redefine the primary analysis.

Only rows admitted by the frozen evidence contract enter confirmatory tables. The contract records workload/task revision, driver/arm, evaluator and data checksums, replay/reset binding, explicit result status, and provenance; preflight, smoke, pilot, broken-task, and evaluator-error rows remain available for audit but are not silently pooled with confirmatory evidence.

## L. Open decisions required before registration

- [ ] Final applications and archived versions/licenses.
- [ ] Concrete CUA/hybrid implementations and model replication policy.
- [ ] Exact task and mutation manifest.
- [ ] Practically meaningful effect sizes and simulated power.
- [ ] API/compute/person-hour budget ceiling.
- [ ] Repair operator count, training, blinding, and censoring limit.
- [ ] Rater-reliability statistic and acceptance threshold for visual/usability stratum.
- [ ] Exact missingness/infrastructure-error rules.
- [ ] Registration host, access policy, embargo, and artifact license.
