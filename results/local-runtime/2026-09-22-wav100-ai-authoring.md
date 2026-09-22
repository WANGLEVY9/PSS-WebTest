# AI-assisted Traditional diagnostic authoring: approved and bounded

The user explicitly approved AI assistance for this diagnostic batch on
2026-09-22. The authorization is bound to the existing 100-task plan SHA256;
the manuscript's design-contract v2.1 and its human-authored baseline are
unchanged. It is no longer necessary to wait for permission to author these
diagnostic scripts. **It is still necessary to satisfy the other deployment,
authentication, isolation, task binding and scheduling gates.**

## Implemented

- A checked, diagnostic-only authorization record. No gold/evaluator reads,
  copied Agent solution traces, runtime Traditional model calls or automatic
  promotion into confirmatory evidence are authorized.
- Public-input/setup-bound 100-row adaptation ledger. Seven initial navigation,
  search and sorting script proposals pass a restricted facade source check;
  93 remain pending. Static acceptance is not a successful runtime test.
- Known previous outcome exposure is explicitly recorded for five selected
  tasks. Independent human blinding is not claimed. A first private ledger
  inherited contradictory exposure flags; it is retained but superseded by
  the corrected second ledger. No historical report was overwritten.
- A new official task, 261, enabled only with the pinned authorization. Four
  profiles use fresh owned resets and the native evaluator. All Qwen Agent
  profiles now explicitly use normalized coordinates in this new diagnostic
  group. Older CSS-coordinate probes remain a separate configuration history.
- Traditional's ordinary hover action is now recorded through the common
  screenshot/trace/action-budget/deadline facade. No hidden-target forced click,
  direct answer URL navigation, database read or runtime LLM is introduced.

## Task 261: distinguish adaptation errors from task outcomes

The first Traditional script tried to click Headphones from the initial page
and hit a 30-second locator timeout. Its screenshot shows Electronics as a
top-level category, with Headphones absent as a visible top-level entry. Its
own Playwright DOM trace also establishes a dynamic role change from implicit
link to menuitem when Magento initializes its menu. This is concrete script
adaptation evidence, not evidence that Playwright cannot perform navigation.

Proposals v2 (two clicks) and v3 (hover then click, link role) are retained as
unexecuted alternatives. The queued v3 repair was cancelled before launch once
the role mismatch was verified. The separately hashed v4 proposal waits for
the Electronics menuitem, hovers it, then clicks the Headphones menuitem. Its
selector evidence comes from the Traditional trace, not evaluator answers or
Agent solution trajectories. The native evaluator will independently assess the
result. The original failed run remains in the deployment/repair history.

The v4 live retest also timed out, on its first menuitem hover, and received
native score zero. Its trace logged waiting for the exact Electronics menuitem.
Thus observing a role transition does not prove that changing the role alone
fixes locator matching. The specific accessible-name/readiness explanation is
still unresolved; do not count this as a repaired script. A separate read-only
locator-authoring check against the older primary instance hit page navigation
timeout before collecting a usable accessibility snapshot. It changed no task
data, is not evidence about the owned fixture's score, and counts as zero tasks.

Final new-run outcomes:

| Configuration | Native score | Actor result |
|---|---:|---|
| AgentLab Pure Visual | 0 | Completed, self-reported success |
| AgentLab Hybrid | 0 | Completed, self-reported success |
| Restricted Browser Use Hybrid | 0 | Completed, self-reported success |
| Traditional initial script | 0 | Locator timeout |
| Traditional independent v4 repair | 0 | Hover locator timeout |

Five executions are one new distinct task, not five new tasks. The three Agent
runs each made three model calls. All five have native evaluations, intact
replay audits and completed owned cleanup. The overall local diagnostic history
now covers three official IDs (260, 261, 274) for each profile, not 100. No failed
task was replaced by an easier ID and no score was overwritten.

The v4 author had already seen task-261 outcomes, so it is not an outcome-blind
repair even though its selector evidence is its own Traditional trace. A running
older supervisor still emitted a two-ID exposure allowlist; its inaccurate
false field is corrected by a separate hash-linked authoring-provenance note,
without rewriting the old note, run or score. Future repair notes automatically
disclose prior exposure. This diagnostic workflow is not the formal human-blind
adaptation protocol and must not be described as such.

Pure Visual and AgentLab Hybrid both finished their initial task-261 runs and
self-reported success, but received native score zero. The inspected Pure Visual
terminal screenshot shows an Electronics page with a Headphones category filter.
This does not establish equivalence to the official category-page destination.
Do not relabel the native zero as a provider failure, override it with the
Agent's own claim, or conclude a benchmark defect without a separate audit.
Original native scoring and any future equivalence analysis must be distinct.

Actual final outcomes, source hashes, API usage and per-profile unique task
counts are in `2026-09-22-wav100-ai-authoring-progress.json`. Repaired runs are
new configurations, not replacements. Source preparation, cancellation of a
queued proposal, and regression tests are not new official task executions.

## What remains before 100 executions per profile

Complete the remaining script families and authentication initialization. In
particular, absence of a per-task require_login flag is not account parity.
Pinned WAV's own examples provide supervisor UI login/storage-state support;
account-dependent goals must not be tested anonymously and called capability
failures. Full mutable-state inventory/isolation and prospective common budgets
remain open. Keep adaptation failures in the deployment denominator rather than
filtering difficult tasks after results are observed.

The current subset is single-site Shopping and does not represent all WAV
environments. ATA retrieval continues separately; neither archive bytes nor
source label parsing are ATA execution evidence. VWA remains deferred locally.
