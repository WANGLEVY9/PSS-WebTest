# Phase 2 admission status — 2026-09-04

**Protocol:** `2.0-draft`  
**Scope:** feasibility/admission pilot evidence only; no confirmatory data collected.

## Completed, local evidence

| Gate item | Status | Evidence boundary |
|---|---|---|
| v0.2 configuration registry | passed | 8 configurations validate; 3 v0.2 reference configurations remain `implemented`, not admitted |
| Adapter conformance | passed | visual, hybrid and scripted contract tests pass using deterministic local doubles; no provider request |
| Full regression suite | passed | 74 contract tests pass; configuration registry and scaling plan validate |
| Qwen local configuration | configured | provider/model/key presence verified without reading or logging key material |
| Bounded Qwen connectivity | passed | unauthenticated BookStack login screenshot accepted once by each visual/hybrid adapter; this is connectivity evidence only |
| BookStack reset-state digest | passed | fresh named test containers/volumes seed to users=2, books=3, pages=6 and produce `bookstack-seeded-state-digest-v1` |
| Scripted v0.2 vertical slice | passed | one local Playwright run emitted a registry-resolved v0.2 record and passed the independent route-and-heading oracle |
| BookStack clean-baseline subgate | passed | three isolated Qwen/BookStack matched blocks: 9 unique registry-resolved v0.2 records, three records per arm, identical reset digest, no reset retries, and all strict cells passed |
| BookStack layout-evolution subgate | passed | three isolated `bookstack-layout-v1` matched blocks: 9 unique v0.2 records, three records per arm, reset digest unchanged, and all strict cells passed |
| BookStack create-page fault-control smoke | passed, non-sample | clean and injected persistence-mismatch controls agree with a fault-aware persisted-state oracle; no agent/provider call and no matched three-arm denominator |
| BookStack create-page paired clean/fault pilot | passed, feasibility only | 18 unique registry-resolved v0.2 records: 3 repetitions × 3 arms × 2 conditions, each with the same reset digest and no reset failure; the paired validity report retains every run in its denominator |

## Explicitly not established

- admission of the three configurations for formal collection (they remain `implemented` in the registry);
- cross-workflow or cross-application generalization, effect estimates, or a general strategy comparison.

## Clean-baseline evidence, strictly bounded

The three independently tagged blocks `phase2-clean-v1` through
`phase2-clean-v3` are retained as separate JSONL ledgers and audited together.
The audit found 9 unique run IDs and three completed records per arm. The
aggregate metrics report each arm's clean valid-completion and strict
end-to-end correctness as 3/3, but their Wilson lower bound is only 0.439;
these data demonstrate feasibility and repeatability of this narrow task, not
superiority or a reliable population-level rate. The aggregate output keeps
false-positive and false-negative rates `null`, correctly, because no fault
condition is included.

Artifacts (ignored from version control) are under
`artifacts/phase2/bookstack-navigation-clean-stable-aliyun-qwen3-vl-flash-phase2-clean-{v1,v2,v3}-*.{json,jsonl}`;
the reproducible aggregate outputs are suffixed `phase2-clean-admission`.
The generated data table and its historical-ledger exclusion inventory are in
[`phase2-experiment-data-2026-09-04.md`](phase2-experiment-data-2026-09-04.md);
regenerate it after new local runs with `npm run report:phase2-evidence`.

The layout-evolution aggregate also has 3/3 strict outcomes per arm. It is
evidence that this declared CSS-only change preserves the navigation task and
oracle on this fixture, not general interface-evolution robustness. The visual
arm's mean action count rose from 2.0 to 4.0 and mean wall time from 4.10 s to
7.21 s; with n=3, these are planning signals rather than effect estimates.

## Paired create-page clean/fault diagnostic, strictly bounded

The `phase2-create-clean-v1` and `phase2-fault-v1` ledgers form the first
matched clean/fault agent pilot for the `bookstack-create-page` workflow. Each
arm has three clean and three injected-persistence-mismatch repetitions.
Scripted and hybrid each recorded 6/6 strict-correct outcomes and 6/6 emitted
clean-or-fault verdicts; visual recorded 1/6 strict-correct outcomes and 1/6
such verdicts. Its all-run fault false-negative rate is 3/3 because every
fault run emitted `unknown` or no usable clean/fault verdict, while its clean
false-positive rate is 0/3. These are diagnostic counts, not comparative
estimates: one SUT, one workflow, one provider/model stratum, and n=3 per
arm/condition do not support a ranking or a population-level error rate.

The independently generated paired report is
[`phase2-bookstack-create-page-paired-pilot-2026-09-04.md`](phase2-bookstack-create-page-paired-pilot-2026-09-04.md).
The all-ledger table now contains 31/36 strict passes across eight isolated
ledgers; that number must remain stratified and must not be treated as an
aggregate success-rate estimate.

## Create-page evolution readiness

The first local scripted evolution-control attempt was retained as a failed
preflight, not as a sample: its initial lifecycle reset exposed only the
`schema-ready` intermediate state rather than a seeded-state digest, so the
workflow was deliberately not executed. The unconditional cleanup reset then
returned the expected seeded digest. No screenshot left the machine and no
external model was called. The runner now records reset exit code and trailing
stderr for a future, explicitly initiated diagnostic; it must not silently
retry this failed preflight or label the existing navigation mutation evidence
as create-page evolution evidence.

## Privacy and cost boundary

The completed bounded probe sent only an unauthenticated login-page screenshot
to the configured Alibaba/Qwen endpoint. Under the user's explicit approval,
the matched navigation and create-page pilot blocks additionally sent
screenshots from an authenticated local BookStack test fixture under the
declared action/time budgets. No production system, personal account, or
production data was in scope. Any new workflow, SUT, or provider is a
separately scoped cost/data-exposure decision.

## Next sequence

1. Freeze the clean baseline ledger and retain the incomplete pre-tagged block
   separately; never merge it into the three-block aggregate.
2. Freeze the paired `bookstack-create-page` clean/fault ledgers and retain
   their all-run validity denominators. The existing `persistence-mismatch`
   trigger applies only to that persisted-state workflow, not to `open-book`.
3. Add the next P1 workflow/SUT cells under the frozen matched design rather
   than increasing repetitions of the same BookStack navigation task.
4. Retain the clean/fault scripted smoke controls separately; a missing
   expected page must not be relabelled as a clean test failure.
5. For each additional matched clean/fault workflow, evaluate validity metrics
   (including FPR/FNR) and fault/evolution invariants without pooling provider,
   model, task, or protocol strata.
6. Only after those gates, decide whether BookStack's configurations can move
   from `implemented` to an admission decision; do not infer a universal arm
   ranking from the clean navigation task.
