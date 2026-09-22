# BookStack open-book Qwen UI-evolution matched pilot

Date: 2026-09-13
Status: pilot evidence; not confirmatory and not sufficient for application
admission.

## Design

The existing `bookstack-open-book` navigation workflow was executed under the
behavior-preserving `bookstack-layout-v1` mutation. One fresh reset was used
for each randomized arm cell. The three arms shared the same intent, initial
state, mutation, budget, and independent visible route/heading oracle:

- Pure visual CUA: screenshot-only;
- Hybrid agent: screenshot plus allow-listed visible structure;
- Accessibility-locator Playwright: deterministic role/locator script.

## Result

| Arm | Strict passed cells | Boundary |
|---|---:|---|
| Pure visual Qwen3.7-VL Flash | 1/1 | none |
| Hybrid Qwen3.7-VL Flash | 1/1 | none |
| Playwright | 1/1 | none |

The matched artifact is:
`code/artifacts/phase2/bookstack-navigation-ui-evolution-bookstack-layout-v1-aliyun-qwen3.7-flash-phase2-t1-bookstack-open-book-qwen-evolution-20260913-pilot.json`.

## Interpretation

This block demonstrates that the Qwen native visual and Hybrid protocols can
complete this short navigation task when the UI changes only through the
declared layout mutation. It does not establish a universal ranking: all three
arms passed, the task is short, and the application still lacks a complete
eight-workflow admission subset plus an isolated fault slot for this workflow.
The result should therefore be used as conditional pilot evidence and as a
candidate for repetition/power estimation, not as confirmatory data.
