# BookStack Search-to-Book2 Feasibility Pilot (2026-09-08)

## Scope and provenance

This is a **non-confirmatory, one-repetition clean-condition feasibility
pilot** for `bookstack-search-and-open-book2`. The flow is adapted from
`benchmark/bookstack/test_cases/search.yaml` in the locally vendored
WebTestPilot repository at commit
`b0659bd9908f11c7957602a9372fc100dda50e40` (Search control → Search Results
→ Books → Book2). It is an adaptation, not a reproduction of WebTestPilot's
reported results.

The PSS-WebTest task has a stricter independent post-run oracle: the final
browser location must be a book-overview route (`/books/<slug>`, not a
descendant) and the exact `Book2` heading must be visible. The evaluator never
provides its result to an arm.

## Executed cell

The three arms ran in the prespecified order encoded in one randomization
block, with a full local BookStack reset before each arm:

`bookstack-search-open-book2-clean-stable-manual-ledger-r2-playwright-hybrid-visual`

All three resets emitted the same verified seed digest:

`6246d6dbf78bf96557b59bdae5d4293ebf1236e6d61868139ee30ced0424257a`.

| Arm | Strict completion + independent oracle | Wall time (ms) | Actions | Interpretation |
| --- | --- | ---: | ---: | --- |
| Accessibility-locator Playwright | pass | 1,902 | 7 | Completed and oracle passed. |
| Hybrid screenshot + declared structure | pass | 7,841 | 4 | Completed, emitted `pass`, and oracle passed. |
| Pure screenshot visual CUA | fail | 19,400 | 10 | Reached Book2 according to the independent oracle but timed out without a completion verdict; retained as `oracle_only_success`, not promoted to success. |

The canonical local ledger is ignored from the public repository because it
contains experimental traces, and is audited with `npm run records:audit`:

`artifacts/phase2/bookstack-search-open-book2-clean-stable-manual-ledger-r2-records.jsonl`

## Infrastructure correction

During the initial controller trial, BookStack's reset wrapper reported
`schema-ready` after only the first three application tables existed. The
application was still applying migrations, so SQL seeding sometimes raced the
migration stream. The gate now requires five critical tables and at least 90
migrations (the version-pinned image's completed migration count) before
seeding. A fresh reset then produced the verified seed digest above. This
correction is a reset-harness change, not a change to ground truth or the
agent outcome rule.

## Evidence boundary

`n=1` per arm is insufficient for a success-rate estimate, paired inference,
power calculation, or a cross-method claim. No fault/evolution cell was run
for this task. The record supports only: (1) the task, oracle, and reset are
executable for all three arms; and (2) the observed pure-visual termination
failure warrants inclusion in the failure taxonomy and further pilot
repetitions. It must not be pooled with earlier prompt/manifests or used as
confirmatory evidence.
