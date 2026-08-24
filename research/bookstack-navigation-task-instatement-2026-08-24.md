# BookStack navigation task instantiation (2026-08-24)

## Purpose

Instantiate the `navigation-open-target` blueprint as the first lower-complexity
BookStack task. The task is intentionally shorter than `bookstack-create-page`
so that the study can separate model grounding failures from rich-text-editor
interaction failures.

## Task contract

- `task_id`: `bookstack-open-book`
- clean intent: authenticate, open `Books`, open the exact book `Book`, stop;
- no page creation or mutation is allowed;
- arms: screenshot-only visual CUA, screenshot plus allowlisted page structure,
  and accessibility-locator Playwright;
- oracle: post-run visible-state evaluator requiring the exact `/books/<slug>`
  overview route (not a chapter/page descendant) and an exact `Book` heading;
- fault slots: wrong target and stale navigation;
- evolution slots: navigation layout change and accessible-name change.

## Admission policy

The manifest entry is `oracle.status=draft` and the task remains
`confirmatory=false` until all three arms pass at least one matched repetition
after a verified reset. A reset failure is an environment failure, not a task
failure. A provider abort, timeout, or non-progressing action remains a failed
arm record. The oracle result is computed only after agent termination and is
never included in the observation contract.

## Execution

```bash
cd /Users/laurantwang/PSS-WebTest/code
npm run pilot:bookstack:navigation
```

The runner writes the non-confirmatory summary to
`artifacts/phase2/bookstack-navigation-pilot.json` and append-only standard
records to `artifacts/phase2/bookstack-navigation-records.jsonl`.

## Current environment gate

An initial runner attempt was incorrectly rejected because it expected the
intermediate `seed-verified` lifecycle JSON rather than the final `seeded`
summary. The runner was corrected and the reset gate was independently rerun:
database readiness, HTTP 302 readiness, and the fixed seed counts all passed.

## Non-confirmatory live pilot

One matched repetition completed on 2026-08-24 with all three arms passing:

| arm | agent status | independent oracle | cell |
|---|---|---|---|
| Playwright | completed | exact `/books/book` route + heading | pass |
| Pure visual (Qwen3-VL-Flash) | completed | exact `/books/book` route + heading | pass |
| Hybrid (Qwen3-VL-Flash) | completed | exact `/books/book` route + heading | pass |

This is a pilot result only (`confirmatory=false`), not evidence for a frozen
repetition count. Earlier attempts also demonstrated why the exact-route oracle
matters: deeper chapter/page routes were rejected even when the page text
contained `Book`.

The subsequent three-repetition clean pilot produced 9/9 successful matched
cells, with all reset attempts passing on that rerun. An earlier rerun had one
transient database startup gate failure, which motivated the predeclared reset
retry policy. Every reset attempt is recorded explicitly; this is an
infrastructure reliability measure, not a way to remove failures from the
analysis denominator. The clean summary is retained at
`artifacts/phase2/bookstack-navigation-pilot.json` and its descriptive Wilson
report at `artifacts/phase2/bookstack-navigation-variance.json`.

## Evolution condition

The next matched condition is `ui-evolution:bookstack-layout-v1`. The existing
mutation changes CSS layout properties only and is installed through the same
browser-context initialization in all three arms. The task intent, target book,
exact-route oracle, model, and action budget remain unchanged. This is a pilot
of evolution sensitivity, not yet a repair study; the repair-after-locator-break
template remains separate.

The first layout-evolution repetition also passed 3/3 arms. Its summary and
variance report are stored separately under the
`bookstack-navigation-ui-evolution-bookstack-layout-v1-*` artifact names. One
evolution repetition is insufficient to estimate maintenance or robustness;
additional evolution repetitions and a repair protocol are still required.
