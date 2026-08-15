# PSS-WebTest — two-day Phase 1–2 execution checklist

## Material Passport

- Origin skill: `experiment-agent` plan mode
- Date: 2026-08-15
- Planning horizon: next 48 hours
- Status: execution checklist; no confirmatory data collected
- Existing evidence: `phase1-collision-freeze.md`, `phase2-feasibility-audit.md`, `PROJECT_EXECUTION_PLAN.md`

## 0. Two-day objective

At the end of the two days we should have a **frozen research brief plus a runnable benchmark decision**, not a paper draft and not a leaderboard.

The minimum successful outcome is:

1. A literature-backed statement of the research gap that survives the current collision audit.
2. Frozen wording for the topic, purpose, research questions, comparison arms, primary outcomes, and scope boundaries.
3. A first experimental design that specifies tasks, oracle authority, UI conditions, repetitions, and analysis units.
4. A ranked benchmark/SUT decision with evidence for license, install, reset, independent oracle, Playwright access, visual/hybrid access, and mutation feasibility.
5. One vertical-slice task specification ready for implementation once the container/runtime blocker is resolved.

The following are explicitly **not** goals for these two days: full confirmatory experiments, model ranking, statistical significance testing, final sample-size claims, or submission-ready prose.

## 1. Current baseline and constraints

- The closest Web-testing predecessors are WebTestPilot, Chevrot et al., and WebTestBench.
- Anchor/ERP-Bench is a near-direct methodological precedent outside software testing; therefore the project must not claim “the first CUA-vs-Playwright comparison” in general.
- The three confirmatory arms are fixed provisionally: pure-visual CUA, hybrid visual + DOM/accessibility agent, and accessibility-locator Playwright.
- The three provisional primary outcomes are functional verdict balanced accuracy, independently scored valid completion, and repair effort after behavior-preserving UI evolution.
- BookStack and Indico are the provisional vertical-slice SUTs; the WebTestPilot bundle is conditional because its images are documented as `linux/amd64`.
- The current machine is arm64 and has no Docker/Colima/Podman on `PATH`; this is a feasibility blocker, not evidence that the benchmark is impossible.
- All conclusions in this plan are design or feasibility conclusions until a run is independently logged and scored.

## 2. Research brief to freeze

### 2.1 Working topic

**Conditional empirical comparison of Web UI test-automation approaches under functional defects and behavior-preserving UI evolution.**

The paper is about software testing and maintenance decisions, not generic Web browsing, enterprise RPA, or general computer-use capability ranking.

### 2.2 Working title

**Pixels, Page Structure, or Scripts? A Controlled Empirical Study of Computer-Use Agents and Traditional Web UI Test Automation**

The title must not contain “first,” “universal,” or “better” unless a later, broader search and the data support a much narrower claim.

### 2.3 Purpose statement

To estimate when the information channel and execution mechanism used by a Web UI testing approach changes test effectiveness, oracle correctness, maintenance effort, cost, latency, and reproducibility, using matched intents, independent ground truth, controlled UI conditions, and repeated runs.

### 2.4 Research questions

- **RQ1 — Effectiveness:** Under clean and seeded-fault application versions, how do the three arms differ in valid test completion and independently scored functional verdict accuracy?
- **RQ2 — Oracle authority:** How do differences vary across visible UI, hidden persisted state, relational/cross-state, and exploratory visual/usability oracles?
- **RQ3 — Evolution and repair:** Under behavior-preserving DOM, accessibility-semantic, visual/layout, and interaction/runtime changes, how do failure probability and repair effort differ?
- **RQ4 — Operations:** How do authoring/repair effort, cost, latency, action/token volume, and run-to-run stability differ, and which task/UI conditions explain the trade-offs?

RQ4 should produce conditional guidance, not a single global winner.

### 2.5 Scope boundaries

Include:

- self-hosted Web applications;
- matched end-to-end test intents;
- independent functional or state oracles;
- seeded known faults and behavior-preserving UI changes;
- deterministic scripted and stochastic agent-based approaches.

Exclude from confirmatory claims:

- public/live websites;
- generic RPA workflows without software-testing intent;
- agent self-reported pass/fail as ground truth;
- visual usability judgments without a stable blinded-rater protocol;
- generic browser navigation benchmarks without defect/evolution conditions;
- fragile CSS/XPath baselines created only to make agents look better.

## 3. Outcome hierarchy to freeze

### Primary outcomes

1. **Functional verdict balanced accuracy:** the evaluator’s pass/fail verdict against known clean/faulty ground truth, with sensitivity and specificity retained.
2. **Valid test completion:** whether the intended preconditions, actions, and checkpoint were reached, independently of the arm’s self-report.
3. **Repair effort:** active person-minutes to restore a failing arm after behavior-preserving UI evolution, with unsuccessful repair recorded as censored/failed according to the preregistered rule.

### Secondary outcomes

- false-positive and false-negative rates;
- authoring time;
- monetary/API cost;
- wall-clock latency;
- action count, token count, and retry count;
- run-to-run failure probability and verdict disagreement;
- failure-mode distribution;
- repair success rate and edit size.

### Mandatory scoring rules

- A missing verdict is not silently converted into a correct pass or fail.
- Timeout, provider refusal, evaluator failure, and environment failure remain distinct labels.
- A run that never reaches the intended checkpoint is not used to claim oracle quality for a verdict it never produced.
- Denominators, missingness, and repeated-run counts appear in every result table.

## 4. Two-day schedule

### Day 1 morning — literature and collision closure

#### Task 1. Re-read the nearest five to eight studies

Read only the sections needed to fill the comparison matrix:

- WebTestPilot;
- Chevrot et al. autonomous Web testers;
- WebTestBench;
- Anchor/ERP-Bench;
- How Benchmarks Mis-Score Computer-Use Agents;
- Průcha et al. RPA comparison;
- one adjacent deterministic-script work such as XTestGen or GPT-4 + Selenium.

For every work record:

- workload type;
- visual/DOM/accessibility observation channels;
- execution arm(s);
- matched-intent design;
- oracle authority;
- UI/fault/evolution conditions;
- outcomes and repetitions;
- artifact/license status;
- exact overlap and exact missing element relative to PSS-WebTest.

**Output:** update the collision matrix or add a dated note to `phase1-collision-freeze.md`.

**Done when:** every “direct conflict” label has a source URL/DOI and a one-sentence reason; every unverified detail is marked `unknown` rather than inferred as fact.

#### Task 2. Run one focused snowball search pass

Use four query families:

```text
"computer-use" Playwright "web testing" empirical
"screen-only" Playwright browser agent matched tasks
"visual agent" "traditional" web UI testing benchmark
"test oracle" computer-use agent web benchmark
```

Snowball from WebTestPilot, Anchor/ERP-Bench, Chevrot, and WebTestBench. Deduplicate by DOI, arXiv ID, title, and repository.

**Output:** a short dated search log containing query, source, date, returned candidate, decision, and reason.

**Done when:** no newly discovered paper satisfies all full-conflict criteria, or the collision gate is explicitly reopened.

#### Task 3. Freeze the novelty sentence

Proposed sentence:

> We conduct a controlled, search-bounded empirical comparison of three Web UI test-automation approaches, focusing on independent test-oracle correctness, behavior-preserving UI evolution, repair effort, and repeated-run operational trade-offs.

**Output:** one approved novelty statement and one “do not claim” list.

**Done when:** the statement does not use “first CUA vs Playwright” or generic superiority language.

### Day 1 afternoon — research purpose and method freeze

#### Task 4. Freeze the three-arm contract

| Arm | Allowed observation | Allowed action | Forbidden information |
|---|---|---|---|
| Pure-visual CUA | screenshot and declared viewport/browser-visible state | coordinate, pointer, keyboard, scroll | DOM, accessibility tree, selectors, network, database, mutation labels |
| Hybrid visual + DOM/accessibility agent | screenshot plus declared DOM/accessibility representation | structured element actions plus visible actions | hidden gold assertions, database state, mutation labels |
| Accessibility-locator Playwright | page plus accessible locators and explicit assertions | deterministic browser actions | runtime LLM adaptation, intentionally brittle selector strategy |

**Output:** `arm-contract.md` or an equivalent section in the preregistration draft.

**Done when:** an independent reviewer can determine whether a tool response violates an arm contract.

#### Task 5. Freeze the causal/comparison structure

Primary independent variable: testing approach/arm.

Prespecified moderators:

- oracle type;
- functional condition: clean versus seeded fault;
- evolution family;
- task complexity;
- application.

Blocking unit: application × task × condition. Run order is randomized within blocks; application and task remain identifiable for mixed-effects analysis.

**Output:** a one-page design diagram or table showing arm × oracle × condition relationships.

**Done when:** every RQ maps to an arm contrast and an observable outcome.

#### Task 6. Specify the independent evaluator

For one candidate task, write:

- visible checkpoint assertion;
- hidden persisted-state assertion;
- relational/cross-page assertion;
- clean-state expected verdict;
- seeded-fault expected verdict;
- infrastructure-error labels.

**Output:** one evaluator specification, not yet production code.

**Done when:** the evaluator can score a run without reading the agent’s claimed verdict.

### Day 1 evening — first decision gate

Complete this decision table:

| Decision | Pass condition | If it fails |
|---|---|---|
| Collision | No full-conflict paper found | Pivot to replication/extension and revise novelty |
| Arm isolation | Screenshot arm has no structured-page leakage path | Redefine arm or reject adapter |
| Oracle independence | At least one hidden machine-checkable assertion exists | Exclude task from confirmatory effectiveness analysis |
| Scope | RQ, arms, primary outcomes fit three months | Reduce interactions/tasks before implementation |

**Day 1 exit artifact:** a frozen research brief plus an open-decision list. No benchmark is admitted yet solely because it is popular or easy to install.

## 5. Day 2 — experiment design and benchmark decision

### Day 2 morning — benchmark candidate audit

#### Task 7. Rank SUT candidates

Start with:

1. BookStack;
2. Indico;
3. PrestaShop;
4. OWASP Juice Shop as a lightweight fallback.

Keep WebArena, VisualWebArena, BrowserGym, WebArena-Verified, WebTestBench, and Chevrot artifacts as reference/integration candidates until reset and oracle requirements are proven.

Do not include Invoice Ninja before license review. Do not treat Focalboard as permissively licensed without inspecting the exact source license.

For each candidate fill `sut-candidate-audit.csv` with:

- upstream commit/tag and image digest;
- application/container/data licenses;
- architecture and resource requirements;
- install/start/ready/stop commands;
- login/account setup;
- snapshot/reset behavior;
- independent oracle access;
- Playwright accessibility-locator feasibility;
- screenshot-only and hybrid observation feasibility;
- mutation feasibility;
- contamination/overlap with prior papers;
- cost and schedule risk.

**Done when:** every field is `confirmed`, `inferred`, or `unknown`, with a source or local verification command.

#### Task 8. Decide primary and fallback benchmark paths

Provisional decision tree:

- If the WebTestPilot BookStack bundle starts, resets, and exposes a usable hidden oracle on arm64 or a documented CI architecture, use BookStack for the vertical slice.
- If Indico passes the same gate, use it as the second SUT for workflow diversity.
- If the bundle fails because of architecture or runtime cost, test Juice Shop as the lightweight fallback; report its CTF-oriented task bias.
- Do not move to WebArena/VisualWebArena as the primary SUT merely to obtain a famous benchmark; their reset/fault-oracle mismatch is a larger threat to validity.

**Output:** `benchmark-decision.md` recording primary, secondary, fallback, rejected, and unresolved candidates.

### Day 2 afternoon — initial experiment design

#### Task 9. Define the vertical-slice task

Choose one workflow with:

- at least two pages or a multi-step interaction;
- a visible final state;
- a hidden persisted-state consequence;
- a clean version and one seeded functional fault;
- a behavior-preserving layout or DOM mutation;
- a stable reset path.

Example shape for BookStack: create/edit a page, navigate away, return, and verify the persisted title/body and visible listing. The exact task must be confirmed against the selected version; this example is not yet an experimental result.

**Output:** `task-manifest.csv` row plus human-readable task card.

Minimum task-card fields:

```text
task_id, app, version, intent, preconditions, allowed_initial_state,
action_checkpoints, visible_oracle, hidden_oracle, relation_oracle,
clean_expected_verdict, fault_id, evolution_ids, reset_command
```

#### Task 10. Define the first mutation pair

Implement only two initial conditions:

1. one behavior-preserving layout/DOM mutation;
2. one seeded functional fault.

Keep the mutation deterministic, versioned, reversible, and independently checked by the evaluator. Do not begin with four evolution families at once.

**Output:** two rows in `mutation-manifest.csv`, plus a before/after verification record.

#### Task 11. Define the pilot run matrix

For the first vertical slice:

- three arms;
- clean, mutated UI, and seeded-fault versions;
- at least three non-confirmatory repetitions per arm-condition cell;
- full trace, timing, action count, cost, and failure category;
- no significance test and no paper claim.

The pilot answers:

- Can all arms receive the same intent?
- Does the evaluator distinguish execution failure from wrong verdict?
- Does the pure-visual arm remain free of DOM/accessibility leakage?
- Can the SUT reset to the same initial state?
- Is the cost/latency envelope feasible?

**Output:** `pilot-run-plan.md` or a corresponding section in the experiment schema.

### Day 2 evening — benchmark gate and handoff

#### Task 12. Complete the Phase 2 gate review

| Gate | Required evidence | Status target after two days |
|---|---|---|
| Runtime | Docker/Compose or documented equivalent available | Open if not installed |
| SUT start | Fresh setup reaches ready state twice | Confirmed/blocked per candidate |
| Reset | Two resets yield identical visible/hidden baseline | Must be confirmed before pilot |
| Oracle | At least one independent hidden assertion | Must be confirmed for vertical slice |
| Arm access | Same local URL can be used by all arms | Design confirmed; execution pending |
| Pure-visual isolation | Serialized observation log contains no structured data | Instrumentation plan confirmed |
| Mutation validity | UI mutation preserves intended behavior; fault changes only target behavior | Must be manually/evaluator checked |
| Legal boundary | Application, image, seed, and data licenses recorded | No unresolved primary candidate license |

#### Task 13. Freeze the next implementation sprint

The next sprint may begin only with these files/decisions:

- one selected vertical-slice SUT;
- one fallback SUT;
- one task card;
- one clean baseline;
- one UI evolution mutation;
- one functional fault;
- one independent evaluator;
- three arm contracts;
- one pilot run matrix;
- a runtime/architecture decision log.

## 6. Deliverable checklist

### Required by the end of Day 1

- [ ] Collision matrix reviewed and dated.
- [ ] Focused snowball search log updated.
- [ ] Novelty sentence approved.
- [ ] “Do not claim” list written.
- [ ] Topic and purpose statement frozen.
- [ ] RQ1–RQ4 mapped to variables and outcomes.
- [ ] Three arm contracts frozen.
- [ ] Primary/secondary outcome hierarchy frozen.
- [ ] Independent oracle authority defined.
- [ ] Day-1 collision/arm/oracle/scope gate recorded.

### Required by the end of Day 2

- [ ] Candidate matrix complete for BookStack, Indico, PrestaShop, and Juice Shop.
- [ ] Reference-only candidates explicitly separated from primary SUTs.
- [ ] License risks recorded for every primary/fallback candidate.
- [ ] Runtime/architecture blocker recorded with an owner and next action.
- [ ] Primary/fallback benchmark decision written.
- [ ] One task card completed.
- [ ] One seeded fault specified.
- [ ] One behavior-preserving UI mutation specified.
- [ ] Hidden evaluator assertion specified.
- [ ] Pilot run matrix and logging fields specified.
- [ ] Phase-2 gate status recorded as passed, conditional, or blocked.
- [ ] No confirmatory data or significance claim reported.

## 7. Explicit non-goals and anti-patterns

- Do not choose a benchmark solely because it has many tasks.
- Do not use a live website as a temporary substitute for a resettable SUT.
- Do not count an agent’s “PASS” string as a ground-truth oracle.
- Do not add a fourth confirmatory arm during the two-day design sprint.
- Do not tune prompts and then call the resulting pilot confirmatory.
- Do not silently treat Docker architecture emulation as native execution.
- Do not commit API keys, local account credentials, paper files, or unreviewed benchmark data.

## 8. Handoff to Phase 3

Phase 3 (benchmark design and gold assertions) can start only if the two-day handoff contains:

```text
research brief: frozen
collision status: GO / pivot required
primary SUT: confirmed or conditional
fallback SUT: named
runtime status: confirmed / blocked
task card: one complete
oracle: independent hidden assertion present
mutations: one UI-preserving + one seeded fault
arms: three contracts frozen
pilot: executable in principle, non-confirmatory
```
