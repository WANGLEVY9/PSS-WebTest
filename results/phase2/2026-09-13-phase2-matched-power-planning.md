# Phase 2 multi-application matched power planning

Date: 2026-09-13  
Status: **planning-only; repetition count and confirmatory collection remain frozen**

The simulation used the normalized matched-block input across the currently
eligible BookStack, Indico, and Juice Shop blocks. Model strata remain
separate:

| Provider/model | Eligible blocks | Applications | Playwright pilot rate | Visual pilot rate | Hybrid pilot rate |
|---|---:|---|---:|---:|---:|
| Alibaba / Qwen 3.7 Flash | 26 | BookStack, Indico, Juice Shop | 98.8% | 13.3% | 35.2% |
| DeepSeek V4.1 Flash | 25 | Indico, Juice Shop | 98.8% | 32.5% | 59.2% |

The planner evaluates 4, 6, 8, 10, 14, and 20 repetitions per cell using
block-level beta posteriors and equal future repetitions across all three arms.
The resulting rejection probabilities are sensitivity outputs, not observed
effect sizes and not a universal strategy ranking. In particular, the current
pilot suggests that Hybrid-versus-visual power is more repetition- and
model-sensitive than the Playwright contrasts, but this is not yet a frozen
research conclusion.

The input is still incomplete for application admission: Invoice Ninja and
PrestaShop contribute no eligible matched blocks because their current ledger
records do not carry the reset-digest contract. BookStack and Indico have some
eligible blocks but remain blocked by their application-level oracle/breadth
gates. Therefore the simulation cannot authorize confirmatory collection.

Machine-readable output: [`2026-09-13-phase2-matched-power-planning.json`](2026-09-13-phase2-matched-power-planning.json).  
Input: [`2026-09-13-phase2-pilot-input.json`](2026-09-13-phase2-pilot-input.json).
