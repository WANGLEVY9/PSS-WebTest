# PSS-WebTest Phase 2 long-run campaign plan

Date: 2026-09-13
Status: execution plan; **not** authorization for confirmatory collection.

The machine-readable execution contract for the long run is
[`code/config/phase2-long-run-execution-manifest.v0.1.json`](../code/config/phase2-long-run-execution-manifest.v0.1.json).
It fixes the lane order, branch actions, shared-SUT concurrency, storage
fields, and fail-closed conditions used by the campaign controller. The
manifest is intentionally still `planning-not-authorized` while application
admission and pilot variance are incomplete.

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
| Triage queue | 27 candidate application IDs across five waves | Five workflow-bearing matrix applications plus 22 candidate-only rows; five additional breadth candidates are now explicitly tracked, but no candidate-only row contributes evidence |
| Confirmatory admissions | 0 applications, 0 workflow slots | Confirmatory collection remains frozen |
| Invoice Ninja | final aggregate matched block for `view-invoice-details`: 18 unique records across 3 conditions and six strata; Playwright 3/3, DeepSeek visual+Hybrid 6/6, Qwen Hybrid 3/3, Qwen visual 1/3, Doubao Hybrid 0/3 provider-blocked; earlier fixed-path rounds are explicitly invalid-ledger | Useful pilot evidence with a clean aggregate audit; the complete eight-workflow application subset and additional repetitions are still not admitted |
| PrestaShop | corrected Qwen medium search/open-product block passed 6/6 (visual 2/2, Hybrid 2/2, Playwright 2/2) after fixing Playwright task alignment; the subsequent style-only UI-evolution rerun passed 3/3 after repairing the Playwright anchor/navigation contract; after repairing AJAX search milestone/mutation detection, simple isolated fault cells produced Playwright 1/1 and Hybrid 1/1 fault verdicts while visual reached oracle-only but exhausted its budget; a positive-scroll/18-step visual ablation still did not emit fault after reaching the renamed card; DeepSeek visual adapter alias repair passed readiness, a medium clean matched block passed 3/3, the same simple fault cell passed 3/3 including visual fault verdict, and the medium evolution cell passed Hybrid/Playwright 1/1 while visual hit a grounding-loop; **the complete three-repetition long-run matched block now has 54 fresh records: Qwen 23/27 strict, DeepSeek 27/27, overall 50/54, with Qwen visual fault 0/3 and Qwen hybrid fault 2/3 at agent-step-budget**; prior clean/fault/evolution canaries and medium/complex Qwen/DeepSeek diagnostics remain separately catalogued | Mutation gate and the new twelve-ledger block are valid and auditable; pure-visual fault behavior remains model-conditional and the remaining workflow subset is still required, so application remains not admitted |
| BookStack | Qwen navigation schema retry passed 3/3; open-book UI-evolution matched block passed 3/3; search/open-book2 clean repetition block passed 6/6 (visual 2/2, Hybrid 2/2, Playwright 2/2); create-page matched gate passed Playwright 3/3 but Hybrid 0/3 and visual 0/3 across clean/fault/evolution; DeepSeek navigation passed 6/6 and search/open-book2 passed 4/6; DeepSeek create-page clean/fault/evolution each passed Playwright 1/1, Hybrid 0/1 provider-format, visual 0/1 grounding-loop; a separate title-recovery prompt ablation also remained Hybrid 0/1 provider-format and visual 0/1 grounding-loop | Reset, behavior-preserving evolution, and independent oracle are reachable; navigation stability is now a positive conditional stratum, but form persistence and fault coverage remain unresolved, so application admission remains blocked |
| Juice Shop | The product-search workflow remains separately catalogued with profile-corrected and condition pilots. The `product-detail` workflow has a two-provider pilot with repeated Qwen diagnostics. A new stateful `add-to-basket` workflow adds 18 fresh records: Qwen visual 0/3, Hybrid 2/3, Playwright 3/3; DeepSeek visual 1/3, Hybrid 2/3, Playwright 3/3 across clean/fault/evolution. Agent fault runs reach the independent omission oracle but generally do not emit the required `fault`; the clean visual failures are wrong-state/step-budget boundaries. The semantic hybrid forwarding and cross-page-state budget defects were repaired before the summarized block. | These are useful task-boundary results, not application admission: five of eight workflow slots are still absent, repetitions are one per provider-condition for basket, and model/framework strata remain pilot-only |
| Indico | Earlier clean blocks mixed legacy profile boundaries; the **profile-corrected replication** adds one reset-isolated block per provider: Qwen Playwright 1/1, Hybrid 0/1 (oracle), visual 0/1 (provider-format); DeepSeek Playwright 1/1, Hybrid 0/1 (oracle), visual 0/1 (grounding-loop). The independent fault apply/remove/isolation gate and browser-context evolution invariant now pass after fixing child SUT URL propagation and login locator contracts. The second `indico-search-events` workflow now has a complete six-block condition pilot: Qwen clean/fault/evolution Hybrid 1/1 in all three, DeepSeek clean/evolution Hybrid 1/1 and fault Hybrid 0/1 oracle-only; Playwright 6/6 and visual 0/6. A provider `return` key mapping defect was repaired, and the DeepSeek condition run used a 120-second wall cap | Clean profile propagation, search mutation/oracle isolation, and one complete condition workflow are evidenced, but create-event remains oracle-sensitive and the remaining workflow slots have not run; application remains not admitted |
| Qwen Hybrid | 9/9 strict in the first Invoice Ninja block; recent-payments clean/evolution pass with one fault termination failure | Model-stratum pilot evidence |
| DeepSeek Hybrid | 9/9 strict in the first Invoice Ninja block; recent-payments clean/fault/evolution mixed but mostly passing | Model-stratum pilot evidence |
| Doubao Hybrid | 0/3 because Ark returned HTTP 429 | External blocked stratum; excluded from capability pooling |
| Browser Use Hybrid | BookStack open-book Qwen sentinel 1/1 strict pass after relative-interpreter path repair; six replay frames/events | Framework-replication pilot only; not pooled with native Hybrid and not an application admission result |
| Stagehand Hybrid | BookStack open-book Qwen sentinel reached visible oracle but required one bounded locator fallback (model-only 0/1) | Fallback-assisted evidence; retained as framework boundary, not a model success |

The queue/matrix discrepancy must be resolved by adding or rejecting candidates
with version, license, reset, and oracle evidence. Names in a blueprint are not
applications in the experimental denominator.

## 3. Campaign tranches

The operational order is deliberately a long-lived queue rather than a single
large burst: L0 readiness/ledger, L1 local-SUT admission, L2 breadth waves, L3
model/framework replication, L4 cross-application workflows, and finally L5
power/confirmatory freeze. The queue may run independent provider lanes in
parallel, but a shared SUT instance is serialized at one active repetition at
a time. This prevents reset races from being mistaken for arm failures.

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
- Treat child-process provider-profile injection as part of the validity contract:
  a matched run is invalid until the selected provider, model, base URL, and key
  profile are coherent in the child process. Configuration failures are retained
  as blocked evidence and never pooled with capability failures.
- Keep `task_state_reached`, `protocol_completed`, `oracle_only_success`, and
  `cell_passed` separate.
- Preserve failures and retries; no best-of-N reporting.
- Commit code and derived reports after every completed tranche.
- Raw screenshots, credentials, and provider secrets remain local and ignored.
- The dashboard may display pilot and blocked records, but must not label them
  confirmatory or admitted.

## 6. Immediate execution queue

1. Complete T0 provider strata: backfill Doubao Hybrid once Ark is reactivated; keep the Qwen/DeepSeek product-detail block as a diagnostic reference for clean versus fault-verdict behavior.
2. Bind and gate a second Invoice Ninja workflow; complete a first matched
   sentinel across all available model strata before using Invoice Ninja
   variance. (Completed on 2026-09-13; evidence remains pilot-only.)
3. Re-run PrestaShop and BookStack with the same run-record/replay contract and
   explicitly separate framework/model strata. PrestaShop's first workflow
   clean/fault/evolution canaries are now complete across Qwen and DeepSeek
   (18 new records; report `results/phase2/2026-09-13-prestashop-longrun-matched-block.md`); BookStack DeepSeek
   navigation/search pilots are now recorded. The create-page title-recovery
   ablation did not pass, so this workflow remains a diagnostic boundary and
   must not be used to inflate admission or variance estimates.
4. Admit the first application only after its complete eight-slot subset is
   machine-checkable; otherwise keep it pilot-only.
5. Expand the Juice Shop task catalog with the remaining workflow families (pagination/filter, delayed feedback, and authorization) before any application-level admission claim; in parallel start the next candidate wave while maintaining the same admission gate.
6. Do not start 14-repetition confirmatory collection before T5 is complete.
