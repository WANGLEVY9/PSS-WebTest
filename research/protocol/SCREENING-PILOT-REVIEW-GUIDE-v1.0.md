# Outcome-blind screening pilot review guide v1.0

Status: **reviewer work queue prepared; no confirmatory authorization**  
Sample: 192 tasks (10% rounded up within 21 benchmark×site strata) from the
1,834-task frozen source inventory.

## Reviewer procedure

1. Start the local dashboard with `cd code && npm run dashboard:serve`, then open
   `http://127.0.0.1:4173/review.html` (the **Screening Desk** link is also in the
   main dashboard sidebar). Select your assigned reviewer mode. Reviewer 1 and
   Reviewer 2 should use separate browser profiles or separate machines; the
   server stores their decisions in separate local files and never mixes them.
2. Each reviewer works from the outcome-blind queue and the pinned source release
   only. The UI exposes task ID, source file, instruction digest, benchmark/site
   tags, and the seven criteria; it deliberately does not expose agent runs,
   evaluator internals, or prior outcomes.
3. Independently record `yes`, `no`, or `unclear` for IC1–IC7 in the UI. Do not
   run any arm and do not inspect agent outcomes, prior pilot records, or
   evaluator internals while screening.
4. Each decision must cite a source-file location or official environment
   documentation. `unclear` is preferred to an unsupported inference.
5. After both first passes are sealed, the adjudicator switches the work mode to
   **Adjudicator · conflicts only**. Only rows with two completed but different
   decisions appear. Record the adjudicated decision and rationale; the service
   keeps both original decisions and appends an event record. The adjudicator
   cannot edit either reviewer’s original row.
6. Export the two reviewer state files for the study archive, compute agreement
   (percent agreement and Cohen’s kappa per criterion and overall), and retain
   the adjudication log with reviewer-independent timestamps.
7. Independently annotate interaction horizon, visual/structural dependency,
   workflow composition, and cross-site status. Keep benchmark-native labels
   separate from manual annotations.

## What the UI does and does not authorize

The review service validates reviewer IDs, candidate keys, criterion codes, and
decision values; writes each reviewer’s materialized JSON plus an append-only
`.events.jsonl`; and exposes progress and conflict counts. The state directory is
`code/artifacts/benchmark-snapshots/screening-review-state/`, which is ignored by
Git and created with owner-only permissions. No review action enables an agent
run: `confirmatory_authorized` remains `false` until the canonical full-inventory
ledger, agreement/adjudication report, and subsequent Traditional adaptation
gate are completed.

## Criterion reminders

- **IC1**: official task in the pinned release; source inventory metadata is
  sufficient evidence.
- **IC2**: verbatim instruction and evaluator are available without semantic
  edits.
- **IC3**: all actions fit the benchmark browser environment.
- **IC4**: the same semantic goal can be attempted by visual, hybrid, and
  traditional interfaces; do not use observed performance to answer this.
- **IC5**: reset/reinitialization is reproducible and documented.
- **IC6**: evaluator is deterministic or has a pre-registered tolerance.
- **IC7**: no secret, CAPTCHA, external account, or privileged information is
  required beyond ordinary browser use.

## Current limitations

The generated sample is only a stratified work queue. The canonical ledger
remains unchanged with null reviewer/adjudication fields, and therefore the
screening gate remains pending. A completed pilot review must still be checked
against the full candidate inventory before freezing `included_tasks.csv`,
`excluded_tasks.csv`, `task_annotations.csv`, and `screening_log.csv`.
