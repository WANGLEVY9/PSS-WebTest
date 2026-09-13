# Juice Shop matched-block power planning

Date: 2026-09-13  
Status: **planning-only; no confirmatory collection authorized**

The planner consumed the normalized pilot input rather than selecting an
individual run file. It retained two live model strata separately:

| Provider/model | Eligible matched blocks | Pilot records used (Playwright / visual / hybrid) | Pilot strict rates |
|---|---:|---:|---|
| Alibaba / Qwen 3.7 Flash | 23 | 150 / 79 / 77 | 98.7% / 12.7% / 33.8% |
| DeepSeek V4.1 Flash | 23 | 150 / 71 / 70 | 98.7% / 35.2% / 64.3% |

An eligible block has the same application, workflow, condition family, live
model, and all three arms, with at least three reset-complete repetitions per
arm. The two model strata are not pooled.

The Monte Carlo grid evaluates 4, 6, 8, 10, 14, and 20 future repetitions per
cell. Each block samples independent beta posteriors from its pilot counts and
then generates equal future repetitions for all arms. This preserves observed
between-workflow/condition heterogeneity better than a single pooled Bernoulli
rate, but it remains a planning assumption.

Under the current pilot assumptions, Playwright-versus-visual and
Playwright-versus-hybrid contrasts have high simulated rejection probability;
Hybrid-versus-visual is more sensitive to the model stratum and repetition
count. These numbers are not empirical confirmatory effects and must not be
used as a universal ranking or as the final sample-size decision.

Machine-readable output: [`2026-09-13-juice-shop-matched-power-planning.json`](2026-09-13-juice-shop-matched-power-planning.json).  
Input: [`2026-09-13-phase2-pilot-input.json`](2026-09-13-phase2-pilot-input.json).

Next gate: complete independent-oracle and workflow-breadth admission for at
least two additional applications, then rerun this planner on the frozen
multi-application input with the preregistered interaction model and analysis
hash. Only after that review can the repetition count be frozen.
