# PSS-WebTest long-cycle experiment plan v1.0

## Material Passport

- Origin Skill: academic-research-suite / experiment-agent
- Origin Mode: plan
- Origin Date: 2026-09-14
- Verification Status: DESIGN-VALIDATED; EXECUTION-NOT-AUTHORIZED
- Version Label: long_cycle_plan_v1.0
- Authority: `FINAL-STUDY-DESIGN-v1.0.md` and
  `code/config/study-design-contract.v1.0.json`

## 1. Purpose and current state

This document turns the confirmed study design into a gate-driven long-cycle
execution plan. It does not authorize evaluated runs.

Current state:

- design principles: frozen;
- confirmatory core: WebArena-Verified, VisualWebArena, and ATA;
- WorkArena++: conditional extension only;
- exact releases, eligible task IDs, configurations, repetitions, and analysis
  hash: not frozen;
- evaluated execution: paused;
- confirmatory authorization: false.

The study asks which testing abstraction is preferable under which task
conditions. It does not assume that CUA, Hybrid, or Traditional testing wins.

## 2. Scientific estimands

### E1 — Controlled paradigm effectiveness

For the same frozen official task and reset state, estimate differences in
official evaluator success among:

1. screenshot-only coordinate-action CUA;
2. screenshot plus allow-listed visible page structure Hybrid;
3. a frozen, human-authored semantic Playwright test.

CUA and Hybrid use the same orchestration skeleton and the same frozen shared
model set wherever technically possible. This makes their contrast primarily
an information/action-abstraction contrast. Traditional remains a deployment
bundle whose one-time authoring cost is measured explicitly.

### E2 — Testing-verdict correctness

On ATA, estimate PASS/FAIL correctness, sensitivity, specificity, false-pass
rate, false-alarm rate, and failure localization using the official labels.
Missing or malformed verdicts are incorrect; the arm's self-verdict is never
ground truth.

### E3 — Reliability and practical cost

Estimate repeated task-level success, all-run reliability, verdict consistency,
latency, actions, model calls, tokens, API expenditure, and human engineering
cost without combining them into a weighted score.

### E4 — Conditional advantage and complementarity

Estimate paradigm-by-task-characteristic interactions and paired exclusive
success/oracle gain. The retrospective oracle is an upper bound, not a deployable
selector and not evidence of causal routing performance.

## 3. Experimental layers

### Layer A — Confirmatory controlled core

The core matched block is:

```text
pinned benchmark × official task × repetition
  ├─ Pure visual × shared model M1
  ├─ Hybrid      × shared model M1
  ├─ Pure visual × shared model M2
  ├─ Hybrid      × shared model M2
  └─ Traditional × semantic Playwright
```

M1 and M2 must be independently provided multimodal model families that pass
the same image-input, action-format, latency, quota, and version-identification
gate. Existing Qwen, Doubao, and DeepSeek integrations are candidates only;
their pilot availability does not automatically admit them.

Primary CUA-versus-Hybrid contrasts are computed within model. Agentic
paradigm summaries give each frozen model equal weight. Traditional comparisons
are reported against each frozen agentic configuration and as pre-specified
equal-weight marginal contrasts; raw run counts never determine weights.

### Layer B — Implementation robustness

After the core is frozen, an outcome-blind stratified subset may evaluate:

- one additional CUA framework;
- one additional Hybrid framework;
- one secondary Traditional framework, normally Selenium/WebDriver;
- an optional third model family.

Layer B is a robustness analysis, not part of the primary denominator. Its
subset, weights, and configurations must be frozen before Layer A collection
begins and therefore before Layer A outcomes are unblinded. It tests whether
results are artifacts of one implementation.

### Layer C — Conditional benchmark extension

WorkArena++ is a separate stratum. It enters only if its benchmark-level gate
passes before task screening. It is never silently pooled with the mandatory
core and cannot change core conclusions merely by changing the denominator.

### Engineering-only layer

BookStack, Indico, Juice Shop, Invoice Ninja, and PrestaShop remain available
for runner repair, security/boundary tests, logging tests, reset stress, and
failure-codebook development. No result from this layer enters a confirmatory
effect estimate.

## 4. Task population and partition protocol

### 4.1 Artifact pin

For every benchmark, record repository commit or release, container/image
digest, task-manifest digest, evaluator digest, license evidence, browser
requirements, reset procedure, and credential provenance. An artifact is
admitted only if a fresh installation reproduces a documented smoke task and
three consecutive reset-evaluator cycles.

### 4.2 Outcome-blind screening

Two reviewers independently apply IC1–IC7 and EX1–EX8 to every official task.
They cannot access any arm outcome. Disagreements are adjudicated and all
decisions retain evidence references.

The four tables below are then frozen and hashed together:

- `included_tasks.csv`;
- `excluded_tasks.csv`;
- `screening_log.csv`;
- `task_annotations.csv`.

The frozen manifest adds a `task_role` field with one of:

- `protocol-pilot`;
- `confirmatory-core`;
- `robustness-subset` when additionally selected for Layer B.

The protocol-pilot subset is selected by benchmark-native strata and seed
`20260914` before any arm runs. It is 5–10% of eligible tasks. Because its
outcomes may influence budgets and configuration, it is excluded from primary
confirmatory estimates. It remains published as pilot evidence.

### 4.3 Task annotations

Use benchmark-native metadata first. Manual labels are outcome-blind and
double-coded. The confirmatory interaction set is limited to:

1. visual dependency;
2. interaction horizon;
3. structural dependency;
4. workflow composition;
5. cross-site/cross-application status.

Oracle type is retained as descriptive benchmark metadata. It is not added as
a confirmatory interaction without a versioned amendment to the frozen v1.0
contract.

Definitions, ordinal cut points, missing-value rules, and transformations are
frozen before pilot outcomes are analyzed. Cohen's kappa is primary for two
coders; Krippendorff's alpha is used where labels or missingness require it.

## 5. Arm contracts and fairness

### 5.1 Common matched conditions

Every matched block preserves the same instruction, initial-state snapshot,
official evaluator, browser/version, viewport, locale/timezone, task parameters,
wall-clock timeout, and benchmark state. Each execution receives an independent
reset; arms never share a mutated SUT instance.

### 5.2 Pure visual

Only rendered screenshots, viewport/cursor state, prior self-actions, explicit
action errors, and declared remaining budget may affect prompts or control flow.
Screenshot digests may detect visual change. URL, DOM, accessibility, OCR
sidecars, harness milestones, network data, evaluator state, or DOM-derived
coordinates may not affect planning, retries, loop detection, termination, or
budget. Boundary violations invalidate the run.

### 5.3 Hybrid

Hybrid receives screenshots plus one canonical, visible-and-interactable
accessibility projection. It contains only ephemeral target ID, role, accessible
name, visible value/placeholder, declared accessibility state, and visible
bounding box. IDs are regenerated on every observation. Recursive schema
validation rejects hidden text, raw HTML, selectors, stable IDs, test IDs,
network/evaluator fields, and application-specific state.

### 5.4 Traditional

The primary baseline is semantic Playwright. Authors see the verbatim official
instruction, public benchmark documentation, the ordinary browser environment,
and framework documentation. They do not see evaluator implementation,
database/API truth, reference answers not supplied by the task, or any agent
trajectory/outcome.

An evaluator custodian exposes only a black-box conformance verdict. Independent
reviewers check semantic equivalence before one final conformance invocation.
That invocation returns PASS/FAIL only, without evaluator diagnostics, and may
not be used as an iterative debugging oracle. The reviewed script is then
frozen. Failure to author, review, or conform after task-set freeze remains a
Traditional deployment failure in the denominator.

The secondary Selenium/WebDriver baseline follows the same authoring protocol
on the pre-frozen robustness subset. It cannot be introduced after seeing
Playwright or agent outcomes.

## 6. Configuration admission and freeze

An agentic configuration is admitted only if it passes all of the following on
engineering-only applications and protocol-pilot tasks:

- authenticated screenshot input and declared model-version response;
- deterministic action-schema parsing without hidden repair;
- boundary conformance and observation-field audit;
- ≥95% provider-response completion over at least 30 pre-registered
  engineering-only connectivity requests per provider/model/interface;
- no unexplained harness timeout, screenshot loss, or trajectory gap;
- complete token, cost, latency, action, and error accounting;
- version/commit pin and reproducible environment build.

Framework/model admission is based on protocol conformance and operational
readiness, not task success. A weak model is not excluded merely for poor pilot
performance after admission.

Freeze artifacts include prompts, model IDs, temperatures, framework commits,
action schemas, step budgets, wall-clock limit, within-run retry policy, browser
image, and configuration digest.

## 7. Run scale and repetition policy

Let `N` be the number of confirmatory-core tasks after screening and pilot
holdout. Layer A contains five execution units per task-repetition, so:

```text
Layer A scheduled units = N × R × 5
```

The final confirmatory schedule must contain at least 3,000 pre-registered
Layer A execution units. This is a scale floor, not a substitute for power or
task diversity.

The superseded target of at least 30 self-selected applications is not carried
forward. Breadth is measured using the sites, applications, task families, and
conditions already defined by the pinned public benchmarks and is reported
descriptively. Applications are never added merely to reach a cosmetic count.

The pilot uses five repetitions per admitted configuration. Power simulation
then selects the smallest `R` in `{5, 7, 10}` that achieves:

- at least 90% power for a 10-percentage-point primary paradigm difference;
- at least 80% power for a 15-percentage-point pre-specified interaction;
- two-sided family alpha 0.05 with the planned Holm comparison family;
- conservative task heterogeneity/ICC inputs taken from the unfavorable end of
  the pilot uncertainty interval.

If `N × R × 5 < 3000`, increase `R` within the predeclared cap or enlarge the
outcome-blind eligible sample before authorization. Never add tasks or
repetitions after inspecting confirmatory significance. If the cap still lacks
power, retain the data and downgrade the affected claim to estimation/exploratory
rather than changing the design post hoc.

Layer B sample size is separately simulated and cannot be used to make Layer A
meet its floor.

## 8. Scheduling, reset, concurrency, and retries

Generate the full schedule before execution using a frozen random seed. Block by
benchmark and task; randomize configuration order within each repetition and
interleave providers over time. Record queue time, worker, environment shard,
provider region, and start order.

Parallelism is permitted only across isolated environment shards. Two runs may
not mutate the same account, database snapshot, or benchmark state. A scheduler
must respect provider quotas and perform readiness checks so that avoidable 429s
are not manufactured by the study.

Failure handling is fail-closed:

- reset/evaluator/browser failure before arm start: invalid infrastructure run;
  rerun the exact scheduled unit after repair;
- harness crash or evidence loss after arm start: invalid run retained in the
  audit ledger; exact rerun only under the frozen invalid-run rule;
- model timeout, malformed output, grounding loop, step-budget exhaustion,
  provider 4xx/5xx after launch, or framework failure: deployment failure, not
  silently retried outside the frozen within-run policy;
- information leak or protocol drift: protocol-invalid; quarantine the batch,
  investigate scope, issue a versioned amendment, and rerun every affected unit;
- confirmed benchmark-wide outage: pause the affected stratum, preserve logs,
  and resume the same schedule after documented recovery.

No failure-triggered method tuning is allowed during confirmatory collection.

## 9. Immutable evidence and run lifecycle

Every scheduled unit progresses through explicit states:

```text
scheduled → environment-ready → arm-started → protocol-completed
          → evaluator-completed → validity-adjudicated → sealed
```

The record keeps these concepts distinct:

- `task_state_reached`;
- `protocol_completed`;
- `evaluator_completed`;
- `official_task_success`;
- `testing_verdict_correct` where applicable;
- `oracle_only_success` as diagnostic only;
- `run_validity`;
- `deployment_failure_category`;
- `cell_passed` only when every strict requirement is satisfied.

Each run directory stores immutable metadata, trajectory/actions, step
screenshots and digests, observation-schema audit, raw provider summaries,
browser events, official evaluator output, cost usage, reset evidence, and
configuration/protocol digests. Secrets, credentials, cookies, and private
tokens are redacted before sealing and never enter Git.

An append-only ledger references artifact hashes. Dashboard data are derived
views; the dashboard is never the source of truth.

## 10. Outcomes and statistical analysis

### RQ1

Analyze binary official success using a mixed-effects logistic model with
paradigm, benchmark, and paradigm-by-benchmark as fixed effects; task nested in
benchmark as a random intercept; repetition accounted for within task and
configuration. With only three mandatory benchmarks, benchmark is not treated
as a population-level random effect.

Report pre-specified within-model CUA-versus-Hybrid contrasts, Traditional
contrasts, equal-weight marginal effects, absolute differences, odds ratios,
95% confidence intervals, and Holm-adjusted p-values. Report every benchmark
separately before macro and disclosed-denominator micro summaries.

### RQ2

Fit pre-specified paradigm-by-characteristic interactions. Continuous/ordinal
features use frozen scaling. Check collinearity and sparse cells before fitting;
do not replace an unidentifiable interaction with a post-hoc subgroup claim.

### RQ3

Report task-level success distributions and all-run reliability. Analyze
right-censored latency with a survival or accelerated-failure-time model rather
than dropping timeouts. Use paired skew-robust methods for actions, tokens, and
cost, reporting median differences and effect sizes. Report setup, per-task
authoring, review, execution, and maintenance costs separately.

### RQ4

Develop the failure codebook on engineering/pilot evidence, then freeze it.
Sample confirmatory failures by benchmark, paradigm, and failure status; two
coders annotate independently while blinded to competing-arm outcomes. Report
agreement, stage/category prevalence, paired exclusive success, and oracle gain.

Primary deployment-effectiveness counts provider/framework failures as
failures. A pre-registered capability-sensitivity analysis may exclude only
independently verified external infrastructure failures. Neither analysis may
relabel logical, grounding, verdict, timeout, or formatting failures.

## 11. Long-cycle phase plan and gates

| Gate | Indicative period | Work | Mandatory exit evidence |
|---|---:|---|---|
| G0 Design freeze | complete | confirm benchmark portfolio, boundaries, adaptation policy | v1.0 contract and freeze record |
| G1 Artifact freeze | weeks 1–2 | pin releases/images/licenses/evaluators and test reset | benchmark artifact manifest, hashes, 3× reset evidence |
| G2 Population freeze | weeks 2–4 | dual screening, adjudication, annotations, role split | frozen CSVs, agreement report, manifest digest |
| G3 Runner remediation | weeks 2–5 | remove visual side channels; canonical Hybrid projection; evidence schema | conformance tests, adversarial leak tests, run-record v1 schema |
| G4 Traditional adaptation | weeks 4–8 | blind authoring, cost capture, semantic review, black-box conformance | ledger completeness, script hashes, deployment failures retained |
| G5 Protocol pilot | weeks 7–9 | execute held-out pilot tasks, stress reset/scheduler/provider | sealed pilot records, infrastructure and cost audit |
| G6 Final power/config freeze | weeks 9–10 | simulate power; freeze R, configs, budgets, retries, models, prompts, analysis | signed confirmatory manifest and analysis hash |
| G7 Confirmatory authorization | gate only | independent conformance/reproducibility audit | all gates green and explicit authorization true |
| G8 Collection | weeks 10–14+ | execute pre-generated randomized schedule; no tuning | ≥3,000 scheduled Layer A units resolved and sealed |
| G9 Analysis | after lock | run frozen RQ1–RQ4 scripts; blinded denominator reconciliation | locked dataset, scripted tables/figures, deviation log |
| G10 Reproduction | final | clean-machine rerun of manifests, selected runs, and analysis | artifact audit, reproducibility report, release candidate |

Calendar estimates are subordinate to gates. A late gate delays later work; it
does not justify weakening admission criteria.

## 12. Roles and access separation

At minimum, record these roles even if one person performs multiple engineering
roles at different times:

- artifact custodian: pins releases and evaluator hashes;
- task screeners/annotators: see task metadata, not arm outcomes;
- Traditional authors/reviewers: see instructions/environment, not evaluator
  internals or agent outcomes;
- evaluator custodian: operates black-box evaluator access;
- execution operator: sees schedule and health, cannot modify frozen configs;
- analyst: receives the sealed dataset after collection lock;
- deviation adjudicator: approves only documented protocol decisions.

Independent screening, semantic review, and failure coding require at least two
people; an LLM-only second opinion does not silently count as an independent
human reviewer.

## 13. Stop, pause, and amendment rules

Pause the affected stratum when any of these occurs:

- repeated reset/evaluator corruption;
- information-boundary leak;
- evidence loss above 1% of launched runs;
- model endpoint/version changes without a stable version identifier;
- provider quota behavior makes randomized scheduling infeasible;
- mismatch between schedule, task digest, evaluator digest, or script hash.

Terminate a configuration only for safety, licensing, endpoint withdrawal, or
inability to satisfy the pre-registered interface—not because it performs
poorly. Preserve all scheduled failures in the deployment denominator.

Every amendment states reason, affected hashes/runs, whether unblinding
occurred, and the exact rerun scope. Pre- and post-amendment strata are never
pooled by default.

## 14. Immediate implementation backlog

Work may begin now only on these non-evaluated tasks:

1. create and validate the benchmark artifact manifest schema;
2. inventory official tasks without running any arm;
3. extend screening tables with task role and freeze digest;
4. replace visual URL/milestone progress with screenshot/action-only logic;
5. centralize and fuzz-test the Hybrid visible-interactable projection;
6. implement benchmark-provenance run-record v1 and sealing;
7. implement role-separated Traditional authoring/review tooling;
8. build deterministic schedule generation and isolated worker leases;
9. implement pilot power simulation and frozen analysis skeletons;
10. add dashboard views for gate status, validity, evidence completeness, and
    failure attribution without exposing evaluator internals.

The next allowed state transition is `G0_COMPLETE_G1_PENDING` to
`G1_COMPLETE_G2_G3_PENDING`. It requires artifact evidence; it cannot be
achieved by adding models or running more legacy pilots.
