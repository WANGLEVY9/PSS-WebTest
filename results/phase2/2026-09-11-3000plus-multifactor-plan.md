# Phase 2: 3000+ multi-factor benchmark plan

Date: 2026-09-11  
Evidence boundary: design and arithmetic only; this artifact is not an empirical result.

## What is frozen at the design level

The study will eventually require at least 30 admitted applications, eight
workflow slots per application, three behavior conditions, three primary arms,
and two minimum repetitions per arm-condition cell before a broad cohort can
be called a `3000+` dataset:

```text
30 applications × 8 workflows × 3 conditions × 3 arms × 2 repetitions
= 4,320 arm executions
```

The preregistered confirmatory target remains 14 repetitions per arm-condition
cell:

```text
30 × 8 × 3 × 3 × 14 = 30,240 arm executions
```

These are target counts, not current observations. The repository currently has
25 named application rows, zero admitted/frozen applications, and zero
admitted/frozen workflow slots. Five additional application slots still need
version, reset, oracle, and tri-arm admission evidence.

## Task coverage

Each admitted application must contribute eight non-duplicate workflow slots.
The quota deliberately crosses several axes rather than treating “number of
steps” as the only difficulty measure:

- scope: single-app/single-page, single-app/cross-page, cross-application
  handoff, and multi-application workflow;
- length: short (1–4 actions), medium (5–10), and long (11–20);
- goal cardinality: single goal, sequential multiple goals, and dependent
  multiple goals;
- task families: navigation, search/filter, form persistence, cross-page
  create/revisit, authorization, delayed save/retry, visual-layout targeting,
  and repair after locator break.

The per-application quota is two short, three medium, and three long workflows;
at least one single-page task, two cross-page tasks, one cross-app handoff, one
multi-app workflow, two single-goal tasks, two sequential multi-goal tasks, and
one dependent multi-goal task. The remaining three slots are allocated after
the application-specific oracle/mutation review, not by duplicating a simple
navigation task.

## Primary comparison and replication strata

The primary matched comparison is:

1. pure-visual CUA (screenshot-only);
2. hybrid visual + declared page structure (screenshot plus accessibility/
   pageStructure, with no gold oracle or mutation label);
3. deterministic traditional testing (accessibility-locator script as the
   primary baseline).

Qwen3.7-Flash, DeepSeek V4 vision, and Doubao Seed 2.1 are model replication
strata for the two agent arms. Provider/model/framework strata stay separate;
they are not pooled into a single “agent” number. Browser Use, AgentLab, and
Stagehand are framework replication strata and must first pass adapter
conformance, replay equivalence, and a matched sentinel. Traditional extensions
(Playwright CSS/XPath, Selenium locator scripts, state-model scripts, and
script-generation-assisted testing) are labelled exploratory comparators until
their own conformance and oracle gates pass.

## Admission and analysis rules

An execution enters a denominator only when it has a version-pinned SUT,
isolated reset digest, complete step-level replay/run record, hidden independent
oracle, and a matched counterpart for the other primary arms. Provider health,
framework adapter, reset, and oracle failures are classified separately; they
are not silently converted into agent failures or successes.

The primary estimand is a conditional arm difference under a fixed admitted
provider/framework stratum. Secondary analyses estimate interactions with scope,
length, goal cardinality, condition, oracle type, maintenance effort, cost,
latency, and repeat-run stability. The design explicitly does not assume a
universal winner: conclusions will be conditional decision boundaries with
uncertainty intervals.

## Current execution order

1. Run a small current-provider matched pilot on the same admitted SUT/workflow
   family, with Playwright, visual, and hybrid sharing reset blocks.
2. Persist identical step-level records for all three arms (screenshot/digest,
   URL, action, provider summary, milestone, timing, and oracle linkage).
3. Admit applications one at a time; expand the named application pool from
   25 to at least 30 only after tri-arm gates pass.
4. Run model/framework sentinel replications as labelled strata.
5. Estimate pilot variance and perform power simulation; freeze repetition count,
   concurrency, exclusion rules, and analysis hashes.
6. Collect the 4,320-execution minimum cohort, then expand to the 30,240
   confirmatory target if all gates remain green.

The machine-readable source and validator are:

- `code/config/phase2-3000plus-multifactor-plan.v0.1.json`
- `code/scripts/validate-3000plus-plan.mjs`

The validator currently reports `planning-not-authorized`, `4,320` minimum
core executions, `30,240` confirmatory executions, and zero admitted
applications. That status is intentional and prevents target arithmetic from
being mistaken for collected evidence.
