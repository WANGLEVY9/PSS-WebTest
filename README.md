# PSS-WebTest

**Pixels, Page Structure, or Scripts?** PSS-WebTest supports a controlled empirical study of computer-use agents (CUAs), hybrid visual-plus-structured-page agents, and traditional Web UI test automation.

## Structure

- `research/`: search protocol, screening ledger, and evidence notes.
- `code/`: experimental harness specification and implementation.
- `artifacts/`: generated, non-versioned execution artifacts.

The manuscript, bibliography, submission packages, and LaTeX build products are intentionally kept local and excluded by `.gitignore`; they must not be committed to this public repository.

## Research focus

Compare pure-visual computer-use agents, hybrid visual-plus-structured-page agents, and deterministic accessibility-locator Playwright suites on matched Web end-to-end test intents. The study will measure not merely task success, but robustness under controlled UI changes, oracle accuracy, maintenance effort, cost/latency, and reproducibility.

The scope was refined after a systematic snowball search: it distinguishes pure visual CUAs, hybrid visual-plus-DOM agents, and deterministic scripts. See `research/SUMMARY.md`, `research/deep-read-notes.md`, and `research/venue-window-2026-08-15.md`.

The zero-to-submission execution roadmap is in `research/PROJECT_EXECUTION_PLAN.md`. The confirmatory design and unresolved decisions are tracked in `research/PREREGISTRATION_DRAFT.md`; it is explicitly an unregistered draft and contains no experimental results.

The first two execution-phase reports are now available:

- `research/phase1-collision-freeze.md`: collision audit and frozen scope; decision is GO with a narrowed claim.
- `research/phase2-feasibility-audit.md`: SUT, benchmark, and harness feasibility; confirmatory gate is not yet passed.
- `research/sut-candidate-audit.csv`: machine-readable candidate matrix with confirmed, inferred, and unknown evidence states.
- `research/two-day-phase1-2-kickoff-plan.md`: the detailed 48-hour checklist, deliverables, gates, and handoff criteria.

Before staging or pushing public changes, run `scripts/check-public-boundary.sh`. It fails if manuscript, bibliography, or submission files have become tracked.
