# Traditional task-to-script semantic review checklist v1.0

Complete this checklist before black-box evaluator conformance. Both reviewers
must remain blind to CUA/Hybrid trajectories and outcomes.

## Provenance

- [ ] Benchmark ID and pinned version match `included_tasks.csv`.
- [ ] Official task ID matches `included_tasks.csv`.
- [ ] The verbatim official instruction is stored as a digest and review copy.
- [ ] Script path, author pseudonym, start/end time, and debug edits are logged.

## Allowed evidence

- [ ] The author used only the official task instruction, public benchmark
  documentation, ordinary browser access, and Playwright documentation.
- [ ] The author did not inspect evaluator implementation or reference-answer
  network traces.
- [ ] The author did not query database/private API ground truth.
- [ ] The author and reviewers did not inspect agent trajectories or outcomes.

## Semantic equivalence

- [ ] Every script action is necessary for, or directly supports, the official
  instruction.
- [ ] The script does not solve a narrower, easier, or different task.
- [ ] Task parameters come only from information present in the official
  instruction or normal user-visible UI.
- [ ] Script assertions do not replace or modify the official evaluator.
- [ ] Network payloads are not used to choose semantic actions or verdicts.

## Locator and synchronization quality

- [ ] Role/name and label locators are preferred where available.
- [ ] Text and test IDs are used only when stable and task-appropriate.
- [ ] CSS fallback is scoped and justified.
- [ ] Absolute XPath, index-only locators, generated classes, and coordinates
  are absent or explicitly justified.
- [ ] Waits are condition-based; arbitrary fixed sleeps are absent or justified.

## Freeze decision

- [ ] Reviewer 1: `PASS` / `FAIL` with reason.
- [ ] Reviewer 2: `PASS` / `FAIL` with reason.
- [ ] Disagreements were adjudicated without arm outcomes.
- [ ] Black-box official evaluator conformance status is recorded.
- [ ] Final script SHA-256 and freeze timestamp are recorded before repetitions.

If adaptation fails after task-list freeze, record the failure in
`traditional_adaptation_ledger.csv`; do not remove the official task.
