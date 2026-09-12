# PSS-WebTest Phase 2 long-run campaign plan

Date: 2026-09-13
Status: execution plan; **not** authorization for confirmatory collection.

## 1. Objective and evidence boundary

The long-run objective is to build a conditional benchmark of Web UI testing
strategies, not to prove a universal winner. The primary comparison remains:

1. Pure-visual CUA: screenshot-only observation;
2. Hybrid agent: screenshot plus explicitly allow-listed visible page structure;
3. Traditional accessibility-locator testing: deterministic scripted baseline.

The target arithmetic is 30 applications × 8 workflows × 3 conditions × 3
primary strategies × 14 repetitions = 30,240 primary arm executions. Model,
provider, and framework variants are replication strata. They are not silently
pooled into the primary arm effect and do not multiply the target until a
budgeted nested replication design is explicitly frozen.

All pilot, provider-blocked, reset-failed, oracle-only, and framework-smoke
records remain visible in the ledger but outside the confirmatory denominator.

## 2. Current starting point

| Item | Current state | Consequence |
|---|---|---|
| Large-scale target | 30 applications, 8 workflows each, 3 conditions, 3 primary arms, 14 repetitions | Design target only |
| Triage queue | 22 candidate application IDs | Five workflow-bearing matrix applications plus candidate-only rows; coverage gap is open |
| Confirmatory admissions | 0 applications, 0 workflow slots | Confirmatory collection remains frozen |
| Invoice Ninja | 66 diagnostic records across 2 workflows, 3 conditions, and multiple model strata | Useful pilot evidence; two workflows now have independent oracles, still not admitted |
| PrestaShop | clean/fault/evolution canaries on one workflow across Qwen and DeepSeek; 18 arm/model records plus reset-retry evidence | Mutation gate passed; fault canary remains mixed and application is not admitted |
| BookStack | Qwen navigation schema retry passed 3/3; create-page matched gate passed Playwright 3/3 but Hybrid 0/3 and visual 0/3 across clean/fault/evolution | Reset, fault injection, and independent oracle are reachable; create-page agent failures are classified and application admission remains blocked |
| Qwen Hybrid | 9/9 strict in the first Invoice Ninja block; recent-payments clean/evolution pass with one fault termination failure | Model-stratum pilot evidence |
| DeepSeek Hybrid | 9/9 strict in the first Invoice Ninja block; recent-payments clean/fault/evolution mixed but mostly passing | Model-stratum pilot evidence |
| Doubao Hybrid | 0/3 because Ark returned HTTP 429 | External blocked stratum; excluded from capability pooling |

The queue/matrix discrepancy must be resolved by adding or rejecting candidates
with version, license, reset, and oracle evidence. Names in a blueprint are not
applications in the experimental denominator.

## 3. Campaign tranches

### Tranche T0 — protocol and provider stability

Purpose: keep the observation contracts and provider strata reproducible.

- Run the same clean/fault/evolution sentinel on Qwen, DeepSeek, and Doubao for
  both agent arms whenever the provider is available.
- Keep Playwright independent of provider availability.
- Record tool schema, action mode, model ID, timeout, retries, screenshot
  digest, page-structure digest, and provider failure category.
- A provider 429/5xx/timeout is an external boundary; it never becomes a
  successful run and never gets relabelled as a model capability result.

Exit gate: every available model/arm has a complete standard record, and every
blocked model has a bounded readiness report.

### Tranche T1 — current local SUT admission

Order: Invoice Ninja, PrestaShop, BookStack, Indico, Juice Shop.

For each SUT, bind eight non-duplicate workflows across navigation,
search/filter, form persistence, cross-page state, authorization, delayed
save/retry, visual-layout targeting, and repair-after-locator-break. Each
workflow must pass:

1. version/image and reset digest gate;
2. independent clean oracle;
3. isolated fault apply/remove/invariant gate;
4. behavior-preserving evolution gate;
5. three-arm matched pilot with complete replay/run-records.

Exit gate: the application is marked `admitted-pilot` only after all bound
workflow slots pass the gates. It is not `confirmatory-ready` until pilot
variance and power inputs are frozen.

### Tranche T2 — breadth expansion

Advance candidates in waves, not by filling the target with repeated runs of
one application:

- Wave 1: Gitea, Nextcloud, MediaWiki, Ghost, WordPress, Redmine, Kanboard;
- Wave 2: Mattermost, Taiga, Discourse, Roundcube, ownCloud, Outline, Plane;
- Wave 3: GitLab, Odoo, ERPNext, Penpot, OpenProject, Cal.com.

Each candidate is either admitted, rejected with evidence, or parked as
blocked. A rejected or blocked application consumes no confirmatory slot.

### Tranche T3 — nested replication strata

After at least three applications pass the primary three-arm gate, add model
and framework replication on a stratified subset:

- models: Qwen, DeepSeek, Doubao when available;
- agent frameworks: native driver, Browser Use, AgentLab, Stagehand only after
  adapter conformance and replay-equivalence checks;
- traditional comparators: Playwright accessibility-locator first, then
  Selenium/state-model/script-generation variants as separately labelled
  exploratory strata.

The nested subset is balanced by application, workflow length, oracle type,
and condition. It is never pooled into the primary arm estimate without an
explicit model/framework interaction term.

### Tranche T4 — cross-application tasks

Cross-application tasks are added only after both endpoint applications are
individually admitted. They include handoff state, identity/session boundary,
data transfer, and relational cross-system oracle checks. Every endpoint and
handoff must have independent reset and oracle layers.

### Tranche T5 — pilot variance and confirmatory freeze

Only after T1–T4 produce complete pilot strata:

- estimate variance by application, workflow, condition, arm, and model;
- simulate power for the pre-registered interaction effects;
- freeze repetition number, concurrency, exclusion rules, retry policy, and
  analysis script hashes;
- timestamp the manifest and start confirmatory collection only after the
  admission and power gates are green.

## 4. Branch decision plan

### Branch A — provider available and stable

Continue the balanced matched tranche. Increase repetitions only after the
same reset and oracle checks pass. Use the provider as a labelled model stratum.

### Branch B — provider blocked or quota-limited

Keep the blocked record, continue Qwen/DeepSeek and Playwright if their budgets
are available, and do not rebalance by silently dropping the blocked stratum.
When service resumes, backfill the exact missing cells with fresh resets.

### Branch C — pure visual remains unstable

Do not declare it impossible. First separate provider-format, grounding,
termination, action-budget, and SUT failures. If instability persists after a
frozen protocol, make failure-boundary and maintenance cost a central result,
while retaining the original conditional comparison.

### Branch D — application admission fails

Reject or park the application and advance the next candidate wave. Never use
candidate-only workflows to fill the 30-application or 240-workflow target.

### Branch E — power is infeasible

Reduce the number of confirmatory interaction effects using a pre-specified
stratified rule; do not collect an underpowered universal leaderboard.

## 5. Operational rules for every tranche

- One immutable run record per execution; append-only JSONL.
- Persist per-step screenshot digest, URL, action, provider summary, milestone,
  timing, and oracle linkage.
- Keep `task_state_reached`, `protocol_completed`, `oracle_only_success`, and
  `cell_passed` separate.
- Preserve failures and retries; no best-of-N reporting.
- Commit code and derived reports after every completed tranche.
- Raw screenshots, credentials, and provider secrets remain local and ignored.
- The dashboard may display pilot and blocked records, but must not label them
  confirmatory or admitted.

## 6. Immediate execution queue

1. Complete T0 provider strata: backfill Doubao Hybrid once Ark is reactivated.
2. Bind and gate a second Invoice Ninja workflow; complete a first matched
   sentinel across all available model strata before using Invoice Ninja
   variance. (Completed on 2026-09-13; evidence remains pilot-only.)
3. Re-run PrestaShop and BookStack with the same run-record/replay contract and
   explicitly separate framework/model strata. PrestaShop's first workflow
   clean/fault/evolution canaries are now complete; BookStack's schema-constrained
   clean diagnostic passed 3/3, while fault/evolution and repetition expansion
   remain gated by pilot variance.
4. Admit the first application only after its complete eight-slot subset is
   machine-checkable; otherwise keep it pilot-only.
5. Expand to the next candidate wave while maintaining the same admission gate.
6. Do not start 14-repetition confirmatory collection before T5 is complete.
