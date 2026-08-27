# Phase 2 live progress update (2026-08-27)

This dated note records the post-stabilization pilot evidence. All runs remain
non-confirmatory. Provider/model strata are never pooled, and a cell is
admitted only when the agent emits the required `pass` termination and the
independent application oracle passes.

## Protocol changes verified before the runs

1. The BookStack lifecycle now waits for the database, the three required
   application tables (`users`, `books`, `pages`), and HTTP readiness before
   seeding. This closes the observed migration/seed race.
2. Visual and hybrid drivers reject a repeated click only when the coordinate
   and the supplied screenshot state are both unchanged. A coordinate by
   itself is not evidence of non-progress after a visible navigation.
3. Standard records distinguish `task_state_reached` (`checkpoint_reached`),
   `protocol_completed`, `oracle_only_success`, and `cell_passed`. A page or
   event that exists after an agent timeout remains measurable but is not an
   admitted cell.
4. Pilot summaries accept `PSS_PILOT_RUN_TAG`, so protocol revisions and model
   strata cannot overwrite or silently mix prior ledgers. Action traces in the
   pilot summary are path/type/coordinate summaries; private run records retain
   only a trace hash.

Contract, manifest, benchmark-matrix, and study-asset checks passed after the
changes: `48/48` contract tests, plus all three validation commands.

## BookStack clean create-page outcome-v02

Each model was run for three repetitions, with a fresh volume reset and an
independent persistence oracle before every arm cell. Both profiles used the
same task, viewport, step budget (`14`), request timeout (`30s`), and decision
retry budget (`2`). The artifacts are ignored local files under
`artifacts/phase2/`.

| provider/model stratum | Playwright | pure visual | hybrid | matched repetitions |
| --- | ---: | ---: | ---: | ---: |
| Alibaba `qwen3-vl-flash` | 3/3 | 0/3 strict cells; task oracle 3/3 | 3/3 | 0/3 |
| Volcengine `doubao-seed-2-0-pro-260215` | 3/3 | 3/3 | 3/3 | 3/3 |

All 18 BookStack reset and clean-state gates passed. Qwen visual failures were
not reset failures: two ended at the step budget after reaching the persisted
page (`oracle_only_success=true`), and one was a genuine grounding loop after
the same screenshot state. The earlier false-positive coordinate guard is no
longer the explanation for the remaining failures. Qwen hybrid completed all
three cells. Doubao visual and hybrid completed all six cells, with wall times
roughly 55--63 seconds per agent cell, so latency is a first-class outcome.

The corresponding planning-only variance reports are
`bookstack-qwen-outcome-v02-variance.json` and
`bookstack-doubao-outcome-v02-variance.json`; power outputs are explicitly
planning simulations, not a frozen repetition decision. The Qwen contrast
visual-vs-Playwright is large in this one task, while the Doubao clean task has
no observed binary arm difference. Neither supports an overall superiority
claim.

## Indico clean authenticated pilot

The Volcengine/Doubao one-repetition three-arm pilot reset the local stack and
recreated the experiment account before each cell. Playwright passed `1/1`
with the independent PostgreSQL event oracle. Visual and hybrid both passed
reset, login, and clean-state checks but reached the 14-step budget without
creating an oracle-visible event: visual took `433378ms` with seven provider
retries, hybrid `245145ms` with two retries. The result is `1/3` cells and no
Indico CUA admission. These are provider latency/grounding outcomes, not
infrastructure exclusions.

## Juice Shop clean pilot

The Volcengine/Doubao one-repetition pilot passed Playwright `1/1` in `1666ms`.
Visual emitted `pass` after four actions but the independent visible UI oracle
did not pass (`73791ms`, one retry), so the cell is not admitted. Hybrid made
no action before a provider timeout (`provider-timeout`). The result is `1/3`.
The UI oracle remains independent of the agent verdict and action history.

## Current gate and next work

The lifecycle and provider connectivity gates pass. BookStack is admitted for
the Doubao stratum and is task-state-complete but termination-unstable for
Qwen visual. Indico and Juice Shop remain feasibility-only because their CUA
arms have not met clean matched admission. Therefore final repetition/power
freezing, fault/evolution agent blocks, and confirmatory collection remain
closed.

The next implementation gate is a bounded provider watchdog and better
termination/latency instrumentation, followed by rerunning the shortest
Juice/Indico workflows with the same frozen protocol. Only after at least one
clean task-condition block per required model stratum has stable three-arm
admission should fault/evolution agent runs and the final pilot variance/power
freeze be considered.
