# Phase 2 agent-stabilization pilot summary (2026-09-10)

This public summary contains only redacted, descriptive pilot evidence. It
contains no credentials, API keys, raw provider responses, screenshots, or
hidden oracle state. The observations are not confirmatory estimates.

## Engineering validation

- Contract tests: **106/106 passed**.
- Latest public code commit: `c769a1d` (Hybrid textbox retry guard) plus the
  subsequent Pure visual retry-prompt patch.
- The Hybrid guard now identifies repeated clicks on `interaction=type`
  controls and asks for the required type action. The Pure visual driver now
  recomputes its re-plan instruction inside the retry loop after a rejected
  click.

## Matched pilot observations

| Task/configuration | Playwright | Hybrid | Pure visual | Interpretation |
|---|---:|---:|---:|---|
| BookStack navigation, Qwen3.7-Flash grounded profile, 3 repetitions | 3/3 | 3/3 | 3/3 | Stable low-complexity navigation slice |
| BookStack create-page, grounded JSON profile, combined 3 repetitions | 3/3 | 2/3 | 1/3 | Visual grounding remains variable; Hybrid improved but is not yet stable |
| BookStack create-page, textbox guard, 1 repetition | 1/1 | 1/1 | 0/1 | Guard fixed this Hybrid repetition; visual selected the wrong book/editor path |
| BookStack create-page, Alibaba tool-call mode, 1 repetition | 1/1 | 0/1 | 0/1 | Tool mode is not adopted as default; Hybrid emitted an incorrect verdict |

All cells above used independent SUT reset and independent postcondition
oracles. A cell is counted as passed only when execution completed and the
oracle matched the predeclared verdict.

## Failure interpretation

- The latest Hybrid success supports the hypothesis that the textbox retry
  contract was an engineering obstacle in some earlier failures.
- The latest Pure visual failure reached a wrong book and a wrong editor path,
  then emitted `fault`; replay events were HTTP 200. This is an observed
  grounding/planning boundary, not evidence of reset or provider outage.
- The tool-call experiment did not improve the matched result and remains a
  diagnostic variant only.

## Evidence boundary and next gate

These results remain pilot/diagnostic evidence. We will not freeze the final
repetition count or start confirmatory collection until the same profile is
repeated across clean, fault, and behavior-preserving evolution conditions,
then contributes to a preregistered variance/power decision. Raw replay and
screenshots remain in the ignored local `artifacts/phase2/` directory.
