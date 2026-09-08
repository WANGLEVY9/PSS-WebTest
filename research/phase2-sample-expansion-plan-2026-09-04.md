# Phase 2 sample-expansion plan — 2026-09-04

## Why the current data are insufficient

The current v0.2 evidence has 18 strict runs: one SUT, one navigation
workflow, one model/provider stratum, one visual framework, one hybrid
framework, and one scripted framework. Its three repetitions per cell are an
admission subgate, not an empirical-study sample.

## Collection ladder

| Panel | Unit of expansion | Formula | Runs | Purpose | Status |
|---|---|---:|---:|---|---|
| Current | 1 workflow × 2 conditions × 3 arms × 3 repetitions | 1×2×3×3 | 18 | feasibility evidence only | completed |
| P1 | 3 existing SUT × 5 workflows × clean/fault/evolution × 3 reference configurations × 5 repetitions | 3×5×3×3×5 | 675 | minimum broad matched reference panel | gated |
| P2 | 9 sentinel workflows × 3 conditions × 4 additional configurations × 5 repetitions | 9×3×4×5 | 540 | model/framework/code-tool generalisation | gated |
| P3 | 18 sentinel cells × 3 configurations × 10 repetitions × 2 time windows | 18×3×10×2 | 1,080 | reliability and temporal-drift estimation | blocked until P1 |
| Confirmatory target | core + generalisation + external panels | predeclared | 19,000–22,000 | paper-level conditional-effect estimates | not authorized |

P1 therefore expands both **breadth** (15 workflows across three SUTs) and
**within-cell reliability** (five repetitions). P2 deliberately does not
substitute provider/model differences for the primary family comparison; it is
a separately labelled generalisation panel.

## Immediate implementation order

| Order | Work package | Required evidence before collection |
|---:|---|---|
| 1 | BookStack create-page fault-aware v0.2 runner | **implemented and smoke-controlled**; next is isolated visual/hybrid/Playwright matched pilot blocks, not formal collection |
| 2 | Four additional BookStack workflows | reset, independent oracle, one fault, one evolution, three-arm clean admission each |
| 3 | Indico and Juice Shop workflows 2–5 | same gates; no task may enter merely because it appears in the benchmark matrix |
| 4 | P2 adapters/configurations | second visual/hybrid provider, second agent loop, Selenium or Cypress code baseline; conformance contracts before pilot |
| 5 | Freeze P1 and preregister | manifests, digests, budgets, randomisation, analysis and missing-data handling |

The machine-readable plan is
[`code/config/phase2-scaling-plan.v0.1.json`](../code/config/phase2-scaling-plan.v0.1.json).
Validate it with `npm run validate:phase2-scaling-plan`.
