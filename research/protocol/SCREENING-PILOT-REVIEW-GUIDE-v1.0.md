# Outcome-blind screening pilot review guide v1.0

Status: **reviewer work queue prepared; no confirmatory authorization**  
Sample: 192 tasks (10% rounded up within 21 benchmark×site strata) from the
1,834-task frozen source inventory.

## Reviewer procedure

1. Each reviewer works from `code/artifacts/benchmark-snapshots/screening-pilot-sample-v1.0.json` and the pinned source release only.
2. Reviewers independently record `yes`, `no`, or `unclear` for IC1–IC7 in a
   private copy of the ledger. Do not run any arm and do not inspect agent
   outcomes, prior pilot records, or evaluator internals while screening.
3. Each decision must cite a source-file location or official environment
   documentation. `unclear` is preferred to an unsupported inference.
4. After both first passes are sealed, merge the two files, compute agreement,
   and adjudicate disagreements. Record the adjudicator and timestamp.
5. Independently annotate interaction horizon, visual/structural dependency,
   workflow composition, and cross-site status. Keep benchmark-native labels
   separate from manual annotations.

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
