# PrestaShop simple functional-fault matched pilot

Date: 2026-09-13

Status: pilot/diagnostic evidence; not confirmatory.

## Cell definition

One independent reset per arm, simple search workflow, Qwen3.7-VL Flash, and
the isolated `search-result-label-omission` mutation. The mutation changes one
visible result label in the page layer while the database remains unchanged;
the independent database oracle therefore expects the seeded product row and
must remain hidden from all testing arms.

## Matched outcome

| Arm | Strict pass | Protocol-complete | Independent oracle | Boundary |
|---|---:|---:|---:|---|
| Playwright | 1/1 | 1/1 | 1/1 | emitted `fault` |
| Hybrid | 1/1 | 1/1 | 1/1 | emitted `fault` |
| Pure visual | 0/1 | 0/1 | oracle-only 1/1 | agent-step-budget |

The pure-visual replay reached the search-results checkpoint and the
independent oracle passed, but it did not emit a bounded fault verdict before
the 12-action budget. The final frames still show the search results page; the
renamed target is lower in the result list, so this is currently a visual
grounding/coverage boundary (scroll-and-inspect), not evidence of a reset or
oracle failure. We retain it as a diagnostic failure and do not recode it as a
successful fault detection.

The Hybrid arm succeeded with the declared screenshot-plus-page-structure
contract and Playwright succeeded with the scripted locator contract. This is
one conditional repetition only; it cannot freeze repetitions or admit
PrestaShop.

Artifact:
`code/artifacts/phase2/2026-09-13-aliyun-qwen3.7-flash-prestashop-functional-fault-search-result-label-omission-canary-phase2-t1-prestashop-simple-qwen-fault-20260913-pilot.json`.

Ledger audit: three unique records in one consistent cell, no duplicate or
malformed records. Variance output is planning-only at n=1/arm.
