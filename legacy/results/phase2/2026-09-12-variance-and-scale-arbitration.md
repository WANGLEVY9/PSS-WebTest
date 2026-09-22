# Variance, power, and scale arbitration (2026-09-12)

Evidence boundary: planning and design arithmetic only. **No repetition count is
frozen by this document and no confirmatory claim is made.** Its purpose is to
record the three competing scale figures, show exactly why a defensible
arbitration is not yet possible, and define the decision rule that will settle
it.

## The three competing figures

| Source | Figure | Structural arithmetic |
|---|---:|---|
| `research/PREREGISTRATION_DRAFT.md` §H | **29,484** | local reference 30 apps × 8 workflows × 3 conditions × 3 arms × 10 reps = 21,600; cross-Web 15 pairs × 2 workflows × 3 × 3 × 10 = 2,700; configuration replication 12 apps × 4 workflows × 3 × 6 configs × 6 reps = 5,184 |
| `config/phase2-3000plus-multifactor-plan.v0.1.json` | **30,240** confirmatory / **4,320** minimum core | 30 × 8 × 3 × 3 × 14 = 30,240; 30 × 8 × 3 × 3 × 2 = 4,320 |
| `config/phase2-scaling-plan.v0.1.json` | **19,000–22,000** | reference panel 12 × 10 × 3 × 3 × 5 = 5,400; fault+evolution 720; generalisation panel 8,400; external replication 2,160 → 16,680; plus near-term panels P1+P2+P3 = 675+540+1,080 = 2,295 → 18,975 ≈ 19,000 |

These are not contradictory measurements. They are **three different designs**:

1. **29,484** is the widest design: it additionally requires a cross-application
   handoff panel and a six-configuration replication panel.
2. **30,240** keeps the 30-application breadth but drops the cross-Web and
   configuration panels and raises the per-cell repetition count to 14.
3. **19,000–22,000** is the narrowest: 12 core applications, 10 workflows, 5
   repetitions, plus a generalisation and an external-replication panel.

## Why arbitration is not yet possible

A repetition count must be chosen so that the design detects a difference of
practical interest. That requires a **non-degenerate pilot variance estimate**.
None of the available pilot data supports one:

| Candidate pilot input | Why it cannot set the repetition count |
|---|---|
| Clean matched canary + 26-repetition scale-up (2026-09-12) | **Ceiling effect.** All three arms are 3/3 in the canary and 78/78 in the partial scale-up. Wilson 95% lower bound for 3/3 is **0.439**; the observed rate difference is 0.000, so the stratified simulation correctly returns zero power at every repetition count. A ceiling pilot estimates no variance. |
| **Functional-fault block `fault-r4` (2026-09-12)** | **Discriminating, but n=3 and single-cell.** Qwen 3/9 versus DeepSeek 9/9, and within Qwen playwright 3/3 versus visual/hybrid 0/3. The Wilson intervals for Qwen visual `[0.000, 0.561]` and DeepSeek visual `[0.439, 1.000]` **overlap**, so the difference is directional but not yet separated. Between-cell variance is not estimable from one application x one workflow, so the simulation swept the declared grid. This is the first usable planning input, not a settled estimate. |
| PrestaShop aligned 45-record subset (2026-09-11) | **Protocol-confounded.** Its pure-visual `0/15` was produced by an inherited `CUA_ALIYUN_ACTION_MODE=json` and an implicit Volcengine `json` default. After normalization the same arm completes the clean task 6/6. Using it would inflate the between-arm difference. |
| PrestaShop fault block r1 (2026-09-11) | **Pre-normalization and provider-limited.** Every agent arm failed with `grounding-loop` or `provider-format`; the Doubao rows are a 429 account boundary. Superseded by `fault-r4`. |
| Historical BookStack pilots | **Single application, single workflow family.** The non-substitution rules forbid replacing missing SUTs or workflows with more repetitions of the same BookStack task. |

Two structural facts compound this:

- **Zero applications are admitted.** Admission requires a pinned version/digest,
  an independent oracle, fault/evolution invariants, and a matched three-arm
  pilot. Today only PrestaShop and the three original pilot SUTs have matched
  data, and PrestaShop still has no reset digest.
- **Zero confirmatory records exist.** Every record produced so far is labelled
  `confirmatory: false`.

## What is decidable now

1. **Which figure is a superset.** 29,484 ⊃ 19,000–22,000 in scope: it adds the
   cross-Web and configuration-replication panels. Adopting 29,484 without
   evidence that those panels change the estimand would buy breadth at the cost
   of power in the core contrast.
2. **The minimum-core arithmetic is sound.** 4,320 executions (2 repetitions per
   arm-condition cell) is the smallest cohort that can be called a multi-factor
   dataset; it is a coverage claim, not a power claim.
3. **The repetition count is the only free parameter that matters for power.**
   With 30 applications × 8 workflows × 3 conditions fixed, going from 2 to 14
   repetitions multiplies executions by 7. Everything else is arithmetic.

## Decision rule (to be applied after the fault and evolution blocks exist)

The arbitration will be settled by the following sequence, in order:

1. Run the matched three-arm blocks for **clean, functional-fault, and
   behaviour-preserving evolution** on at least the two ready provider strata.
   The clean condition alone cannot inform power because it is at ceiling; the
   fault condition is the one that separates the arms.
2. Estimate the between-cell variance from those blocks
   (`npm run pilot:variance` for Wilson intervals;
   `node scripts/power-simulation.mjs --mode stratified --input <pilot.json>`
   for the cluster-level Monte Carlo power curves). The simulation reports the
   variance source it used and sweeps a declared sensitivity grid when fewer
   than two cells per arm exist.
3. Declare the minimum effect of practical interest **before** reading the power
   curves.
4. Adopt the smallest figure that reaches the target power at that effect:
   - if power is reached with 12 applications and 5 repetitions → adopt the
     **19,000–22,000** design and drop the cross-Web/configuration panels;
   - if not, and the core contrast is still underpowered at 10 repetitions →
     adopt the **30,240** design (14 repetitions) and drop the extra panels;
   - adopt **29,484** only if the cross-Web and configuration-replication panels
     are shown to answer a question the core panel cannot, and the budget
     supports both.
5. Record the outcome as a versioned preregistration amendment. The three
   figures must be reconciled to one number in `PREREGISTRATION_DRAFT.md` §H at
   that point.

## Tooling added

`code/scripts/power-simulation.mjs` now supports two modes:

- `--mode legacy` (default): unchanged two-proportion table on Jeffreys-smoothed
  pilot rates, so existing invocations keep working.
- `--mode stratified --input <matched-pilot-summary.json>`: a cluster-level
  Monte Carlo simulation. Each application × workflow cell draws its own true
  rate around the pooled pilot rate (a cell-level random intercept), because the
  planned design repeats runs inside cells and a plain two-proportion
  calculation understates the required repetition count. The between-cell
  variance is estimated from the pilot when at least two cells per arm exist and
  otherwise swept over `{0, 0.02, 0.05, 0.10}`, and the source used is reported
  per contrast.

Demonstration on the clean canary (ceiling effect, correctly reported):

```json
{"playwright":{"trials":3,"successes":3,"rate":1},
 "visual":{"trials":3,"successes":3,"rate":1},
 "hybrid":{"trials":3,"successes":3,"rate":1}}
→ observed_rate_difference 0.000; estimated_power 0 at every repetition count
```

## Current status

```text
clean_canary_variance_estimate: unusable (ceiling: 78/78 in the partial scale-up)
evolution_block_variance:       unusable (ceiling: 18/18)
fault_block_variance:           PARTIAL — discriminating (Qwen 3/9 vs DeepSeek 9/9)
                                but n=3, one cell, Wilson intervals overlap
admitted_applications:          0
confirmatory_records:           0
repetition_count:               NOT FROZEN
scale_figure:                   NOT ARBITRATED
```

### What the fault block does settle

For the largest possible contrast (playwright 1.000 versus agent 0.000), the
stratified simulation returns **power 1.000 at 4 repetitions per cell for every
swept between-cell variance**. That is a floor, not a general answer: a
difference of 1.000 is the maximum possible, and the between-cell variance is
assumed rather than measured. It does establish that the **19,000–22,000**
design's 5 repetitions are adequate for the largest effects and that the binding
constraint is **breadth (applications and workflows), not repetitions** — which
argues against adopting 30,240 before a second application exists.

## Next work

1. Complete the clean scale-up and re-run the variance report on it (still
   expected to be at or near ceiling).
2. Run the functional-fault and evolution matched blocks, which are the inputs
   that can actually set the repetition count.
3. Declare the minimum effect of practical interest.
4. Apply the decision rule and reconcile §H to a single figure.
