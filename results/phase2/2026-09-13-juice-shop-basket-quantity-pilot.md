# Juice Shop `basket-quantity` matched pilot

Date: 2026-09-13
Status: **pilot/diagnostic only; not confirmatory and not application admission**

## Scope

This tranche adds the eighth declared Juice Shop workflow. Each execution starts
from a fresh reset-verified catalog, adds `Apple Juice (1000ml)` twice, opens
the basket, and is scored by an independent visible-state oracle requiring the
exact target, quantity `2`, and `Total Price: 3.98¤`. The functional-fault
condition removes the target product only in the browser context; the UI-
evolution condition changes layout CSS without changing semantics. The agent
arms receive only their declared observations; Playwright is a deterministic
accessibility-locator script.

Providers/models are kept as replication strata:

- Alibaba-compatible Qwen: `qwen3.7-flash`
- DeepSeek: `deepseek-v4-flash-vision-exp`

There is one repetition per provider × condition. The six three-arm blocks
therefore contain 18 append-only run records.

## Strict three-arm outcomes

| Provider/model | Condition | Pure visual | Hybrid | Playwright |
|---|---:|---:|---:|---:|
| Qwen 3.7 Flash | clean-stable | 0/1 | 1/1 | 1/1 |
| Qwen 3.7 Flash | UI evolution | 0/1 | 1/1 | 1/1 |
| Qwen 3.7 Flash | functional fault | 0/1 | 0/1 | 1/1 |
| DeepSeek V4.1 Flash | clean-stable | 0/1 | 1/1 | 1/1 |
| DeepSeek V4.1 Flash | UI evolution | 1/1 | 1/1 | 1/1 |
| DeepSeek V4.1 Flash | functional fault | 0/1 | 0/1 | 1/1 |

The Playwright arm is 6/6 strict. Pure visual is 1/6 and Hybrid is 4/6.
The pilot-level result is not a model ranking: it is a workflow-boundary
observation with one repetition per stratum.

## Failure-boundary audit

- Qwen visual clean: `grounding-loop`, no independent task state reached.
- Qwen visual UI evolution: `agent-step-budget`, no independent task state
  reached.
- Qwen visual fault: independent omission oracle reached, but the agent did not
  emit `fault` before the step budget (`oracle_only_success=true`).
- Qwen Hybrid fault: same oracle-only/step-budget boundary.
- DeepSeek visual clean: `grounding-loop`, no independent task state reached.
- DeepSeek visual fault: independent omission oracle reached, but no `fault`
  was emitted before the step budget.
- DeepSeek Hybrid fault: same oracle-only/step-budget boundary.

The reset digest was stable across all six blocks and the independent
three-condition Playwright gate passed. No record was excluded for SUT reset,
oracle contamination, or provider transport failure. Thus this tranche mainly
exposes agent termination/grounding behavior on repeated state transitions; it
does not prove that CUA or Hybrid is intrinsically incapable of the task.

## Reproducibility artifacts

- [run-record metrics summary](/Users/laurantwang/PSS-WebTest/results/phase2/2026-09-13-juice-shop-basket-quantity-metrics-summary.json)
- [machine-readable eight-slot admission audit](/Users/laurantwang/PSS-WebTest/results/phase2/2026-09-13-juice-shop-admission-audit.json)
- [task manifest](/Users/laurantwang/PSS-WebTest/code/config/juice-shop-basket-quantity-run-manifest.v0.1.json)
- [independent quantity oracle](/Users/laurantwang/PSS-WebTest/code/src/oracles/juice-shop-basket-quantity.mjs)
- [traditional gate](/Users/laurantwang/PSS-WebTest/code/tests/traditional/juice-shop-basket-quantity.spec.js)

The six source JSONL ledgers are retained under `artifacts/phase2/` and pass
the run-ledger audit with 18 unique run IDs and no missing arm.

The broader Juice Shop audit now sees 530 parseable historical records. The
pagination backfill and model-stratified repetition tranches removed all
missing cells and pooled repetition deficits; only two explicitly quarantined
legacy `qwen3-vl-flash` cells remain below the provider/model threshold, and 18
historical records are rejected by the registry as invalid/legacy evidence.
The current Qwen 3.7 Flash and DeepSeek V4.1 Flash strata are ready for a
pre-specified variance/power analysis, but this does not authorize
confirmatory collection.

## Decision

The eighth workflow slot is now declared and machine-valid, but Juice Shop
remains `provisional`: the application admission checklist, balanced
repetitions, variance estimation, and power freeze are still open. These
records may inform failure-taxonomy and task-design decisions only; they must
not enter the confirmatory denominator.
