# BookStack create-page paired clean/fault pilot — 2026-09-04

**Generated:** 2026-09-04T13:20:34.960Z  
**Scope:** Phase 2 feasibility/admission pilot; this is not confirmatory evidence.

| Arm | Clean n | Fault n | Strict correct | Strict rate | Verdict coverage | Coverage rate | FPR | FNR | Sensitivity | Specificity | Balanced accuracy | Failure categories |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| hybrid | 3 | 3 | 6/6 | 100.0% | 6/6 | 100.0% | 0.0% | 0.0% | 100.0% | 100.0% | 100.0% | none |
| playwright | 3 | 3 | 6/6 | 100.0% | 6/6 | 100.0% | 0.0% | 0.0% | 100.0% | 100.0% | 100.0% | none |
| visual | 3 | 3 | 1/6 | 16.7% | 1/6 | 16.7% | 0.0% | 100.0% | 0.0% | 33.3% | 16.7% | agent-step-budget:1, provider-format:2, grounding-loop:2 |

Definitions follow metric-dictionary.v0.1: FPR is clean runs reported as fault; FNR is fault runs reported as clean, unknown, or not-emitted. All runs stay in the denominator. Verdict coverage is shown separately because a non-emitted verdict is an end-to-end failure, not a reason to discard a run. With n=3 per condition/arm and a single task/model stratum, these values are descriptive pilot diagnostics only; do not infer a general arm ranking.
