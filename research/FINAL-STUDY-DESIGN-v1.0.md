# PSS-WebTest final study design v1.0 — confirmed and frozen

> **Historical v1.0 record.** The current design is v2.1, selected by the active machine pointer; see [design authority](DESIGN-AUTHORITY.md). Counts, plans, gates and freeze claims below belong to the original version and do not authorize current collection.

Date: 2026-09-14

Status: **human-confirmed design freeze; experiment execution paused; confirmatory collection not authorized**

Confirmation date: 2026-09-14

Machine-readable contract: `code/config/study-design-contract.v1.0.json`

## 1. Decision and scope change

The study is re-centered on an externally defined, multi-benchmark comparison of
three Web UI testing paradigms. It will not create a new benchmark population or
promote locally invented workflows, faults, or UI evolutions into confirmatory
tasks. Existing BookStack, Indico, Juice Shop, Invoice Ninja, and PrestaShop
runs remain useful engineering and feasibility evidence, but they are outside
the denominator of the redesigned confirmatory study.

The primary scientific estimand is the effect of the testing abstraction:

```text
pixels              -> pure-visual CUA
visible page structure -> Hybrid agent
explicit test code  -> Traditional scripted testing
```

Framework and model are nested implementation factors. The paper must not
collapse a framework/model leaderboard into a paradigm claim.

## 2. Final benchmark composition

### Mandatory core

1. **WebArena-Verified** — general-purpose, realistic, reproducible Web tasks.
2. **VisualWebArena** — externally defined visually grounded Web tasks.
3. **Autonomous Tester Agent Benchmark** accompanying *Are Autonomous Web
   Agents Good Testers?* — explicit test steps, assertions, passing/failing
   cases, and testing verdicts.

The exact denominator for the Autonomous Tester Agent Benchmark will be
computed from the pinned artifact. Public descriptions currently refer to
different snapshots, so no task count is copied into the design before the
artifact audit.

### Pre-registered conditional extension

**WorkArena++** is included only if a reproducible ServiceNow instance, common
official evaluator, reset, and credentials pass before task screening. If the
gate fails, the entire benchmark is excluded before any arm outcome is
observed. It cannot be added or removed in response to performance.

### External validity only

A live-Web benchmark may later test whether the main controlled findings remain
visible on current websites. It is reported separately and cannot alter the
primary confirmatory estimate.

## 3. Official-task filtering protocol

The sampling unit is `pinned benchmark release × official task ID`. Every task
must retain its verbatim instruction, initial-state semantics, and official
evaluator.

**Hard freeze HF1:** the eligible task set and its manifest digest must be
frozen before *any* arm is executed. A post-freeze task-list change requires a
versioned amendment and a complete rerun of every affected arm; the list may
never be edited in place after outcomes are observed.

### Inclusion

A task is eligible only when all seven conditions hold:

1. it exists in the pinned public benchmark release;
2. its official instruction and evaluator can be preserved unchanged;
3. execution occurs wholly through the benchmark browser environment;
4. all three paradigms can in principle attempt the same semantic goal;
5. reset or reinitialization is reproducible;
6. the evaluator is deterministic or has a pre-registered tolerance;
7. no unavailable secret, external application, or privileged information is
   required.

### Exclusion

Only the predefined EX1–EX8 codes in the machine contract are permitted:
external/non-browser dependency, unreproducible credentials or CAPTCHA,
broken pinned environment, defective/missing evaluator, failed reset,
three-paradigm incompatibility, license restriction, or official duplicate.

Poor performance, provider timeout, high cost, or an inconvenient result is
never a task-exclusion reason after the list is frozen.

### Screening and sampling

- Two reviewers independently screen every task, then adjudicate disagreements.
- A 5–10% outcome-blind codebook pilot may clarify criteria.
- Use the complete eligible task set whenever feasible.
- If sampling is required, use benchmark-native strata and seed `20260914`.
- Freeze `included_tasks.csv`, `excluded_tasks.csv`, `screening_log.csv`, and
  `task_annotations.csv` before any evaluated arm runs.

RQ2 annotations use benchmark-native metadata first. Manual labels—interaction
horizon, visual dependency, structural dependency, composition, and cross-site
status—require at least two outcome-blind annotators and agreement statistics.

## 4. Strict information boundaries

Fairness means the same official intent, benchmark state, evaluator, viewport,
browser version, and wall-clock timeout, with paradigm-appropriate interfaces.
It does not mean identical low-level observations.

### Pure-visual CUA

Allowed: screenshots, viewport size, cursor, prior self-actions, action errors,
and remaining budget. Actions are human-equivalent coordinate mouse/keyboard
operations, scrolling, dragging, waiting, and finishing.

Forbidden: URL strings not rendered in browser chrome, DOM, accessibility
tree, OCR side channels, element lists or IDs, selectors, DOM-derived
coordinates, network payloads, JavaScript, evaluator state, database/API truth,
or hidden application state.

### Hybrid agent

Allowed: the CUA inputs plus an allow-listed projection of visible and
interactable accessibility information: ephemeral target ID, role, accessible
name, user-visible value/placeholder, selected/checked/disabled/expanded state,
and visible bounding box. Hybrid may use semantic actions over those ephemeral
targets.

Forbidden: raw HTML, hidden/off-screen dumps, stable application IDs,
`data-testid`, CSS/XPath, DOM classes, listeners, network payloads, JavaScript,
evaluator state, or database/API truth. Target IDs must be regenerated from the
current visible projection and cannot encode selectors or application identity.

### Traditional scripted testing

Runtime scripts may use public DOM/accessibility information, visible text and
state, and browser events for synchronization. They may not inspect evaluator
implementation, reference answers absent from the task instruction, databases,
private APIs, agent trajectories, or held-out failures. Network events can be
awaited, but response payloads cannot choose the semantic action or verdict.

The official evaluator is hidden from all arms and remains the sole source of
ground truth. A self-reported agent verdict or script assertion is diagnostic,
not ground truth.

## 5. Fair Traditional adaptation protocol

The Traditional arm represents a deployment bundle: a frozen human-authored
script, its measured one-time engineering cost, and its repeated runtime
behavior. This is intentionally different from zero-shot agent execution; the
cost difference is measured rather than concealed.

Authors receive only the official task instruction, public benchmark docs,
ordinary access to the pinned browser environment, and Playwright docs. They
must be blind to evaluator source, reference trajectories unless officially
part of the task specification, database truth, and all CUA/Hybrid results.

**Hard freeze HF2:** both authoring and semantic-equivalence review must finish
without access to evaluator internals and without access to CUA/Hybrid outcomes.
Violating this rule invalidates the script and every run produced from it.

For every official task:

1. register author pseudonym and timing;
2. embed the verbatim official instruction in script metadata;
3. implement only instruction-required interactions;
4. record locators, assertions, waits, and every debug edit;
5. conduct independent semantic-equivalence review;
6. perform only black-box conformance with the official evaluator;
7. freeze the script hash before matched repetitions.

Locator order is role/name, associated label, stable user-facing text,
officially documented stable test ID, then scoped CSS only if unavoidable.
Absolute XPath, index-only selectors, generated classes, and coordinates are
discouraged and must be justified.

If a script cannot be authored or pass semantic review after the task list is
frozen, that is retained as a Traditional deployment failure. The task is not
removed. Required cost data include authoring, debugging, review time, LOC,
locator/assertion counts, and debug edits.

## 6. Outcomes and analysis

Primary outcomes are official task success and, on the testing-specific
benchmark, testing-verdict correctness. Testing metrics include sensitivity,
specificity, false-pass rate, false-alarm rate, and failure localization.

Reliability is evaluated from repeated task-level success and verdict
consistency. Efficiency retains wall time, actions, LLM calls, tokens, API cost,
and retries. Engineering cost separates shared infrastructure, per-task
authoring, adapter configuration, and—only where an official version change
exists—maintenance.

No arbitrary weighted score is allowed. Results are reported per benchmark,
with both macro and disclosed-denominator micro aggregates.

- RQ1: paired mixed-effects logistic analysis of official task success.
- RQ2: paradigm × task-characteristic interactions.
- RQ3: task-level reliability and paired cost/latency comparisons.
- RQ4: double-coded failures plus exclusive-success and oracle-gain analyses.

Report absolute effects, confidence intervals, and effect sizes; apply Holm
correction within pre-registered comparison families.

## 7. Consequences for existing Phase 2 work

The old `30 applications × 8 workflows × 3 conditions × 3 arms × 14
repetitions` target is superseded. Its local runs remain auditable but cannot
establish the redesigned study's benchmark-level claims.

Study-created functional faults and UI-evolution mutations remain valuable for
adapter stress testing. They cannot be called confirmatory conditions unless
an included public benchmark officially defines the mutation or version
change. Consequently, maintenance/repair claims are secondary and conditional
on finding an official versioned benchmark condition.

Models and frameworks are selected only after the benchmark/task and
information contracts are confirmed. They will be frozen as nested
implementation strata, not as the organizing principle of task selection.

## 8. Resume gate

No new evaluated experiment begins until all of the following are complete:

- benchmark releases and licenses are pinned;
- official task IDs are screened and adjudicated;
- included/excluded/annotation tables are frozen;
- CUA and Hybrid boundary conformance tests pass;
- Traditional authoring ledger and semantic-review checklist pass;
- pilot and power policies are registered;
- prompts, frameworks, models, budgets, retry rules, scripts, and analysis hash
  are frozen.

Until then, repository execution status remains `paused`, and confirmatory
authorization remains `false`.

## 9. Confirmation record

The study owner explicitly confirmed v1.0 on 2026-09-14, including:

1. WebArena-Verified, VisualWebArena, and ATA as mandatory core benchmarks,
   with WorkArena++ admitted only through its pre-registered environment gate;
2. all existing five-application data retained exclusively as pilot and
   engineering evidence;
3. Traditional adaptation failures retained in the deployment-effectiveness
   denominator;
4. removal of every URL/milestone side channel from the future pure-visual
   control loop.

This confirmation freezes the design principles, not the yet-unpinned task
IDs, model configurations, repetition count, or confirmatory authorization.
