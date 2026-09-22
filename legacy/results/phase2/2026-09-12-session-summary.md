# Phase 2 session summary — 2026-09-12

Evidence boundary: every record produced in this session is admission/pilot
evidence with `confirmatory: false`. **Confirmatory collection remains frozen.
Zero applications are admitted. The confirmatory population is still 0.**

## What was delivered

| Line | Deliverable | Status |
|---|---|---|
| A | Frozen provider-profile manifest + protocol resolver + fail-closed drivers | done |
| A | Executable provider-readiness gate (`npm run readiness:provider`) | done |
| A | Clean matched canary, 2 ready provider strata | done, 18/18 |
| A | Clean scale-up | **partial**, 78/600, stopped deliberately |
| B | Functional-fault detection block | done, discriminating |
| B | Behaviour-preserving evolution block | done, 18/18 |
| C | Invoice Ninja independent database oracle + Playwright cell wiring | done |
| C | Wave-1 candidates | not advanced (blocked on local assets) |
| D | Stratified cluster Monte Carlo power simulation | done |
| D | Scale arbitration | **not arbitrated** (documented why) |
| — | Stratified ledger audit workbook | done |

## A line: protocol normalization

Before: the action mode was an implicit per-provider driver default
(`aliyun`/`deepseek` → `tool`, `volcengine` → `json`). `code/.env.doubao` omits
the variable, so that stratum silently ran textual JSON while the model matrix
declared `tool_calling: true`.

After: `code/config/provider-profile-manifest.v0.1.json` is the single source of
truth, resolved as `explicit env override → frozen profile → legacy default`
with the source of every field recorded. The matched runners set
`PSS_REQUIRE_FROZEN_PROFILE=1`, so an unknown provider/model is a hard error.

Run records now carry `provider_profile_id`, `action_mode`, `api_mode` and
`action_mode_source`, so a protocol change can never be reported as a
strategy-family effect.

### Readiness gate

| Profile | visual | hybrid | Status |
|---|---|---|---|
| `aliyun-qwen3.7-flash-tool-v1` | ready | ready | **ready** |
| `deepseek-v4-flash-vision-tool-v1` | ready | ready | **ready** |
| `volcengine-doubao-2-1-pro-tool-v1` | blocked | blocked | **blocked (429)** |

Doubao is blocked by an external account boundary: the Ark account inference
limit is reached and the model service is paused under Safe Experience Mode. It
is recorded as blocked and skipped, not reported as a capability result.

## The headline finding

The previously reported pure-visual `0/15` was a **protocol confound**. After
normalization the same arm on the same workflow completes:

| Condition | Qwen pure visual | Qwen hybrid | Qwen playwright |
|---|---:|---:|---:|
| clean-stable | 3/3 (and 26/26 in the scale-up) | 3/3 | 3/3 |
| ui-evolution | 3/3 | 3/3 | 3/3 |
| **functional-fault** | **0/3** | **0/3** | **3/3** |

| Condition | DeepSeek pure visual | DeepSeek hybrid | DeepSeek playwright |
|---|---:|---:|---:|
| clean-stable | 3/3 | 3/3 | 3/3 |
| ui-evolution | 3/3 | 3/3 | 3/3 |
| **functional-fault** | **3/3** | **3/3** | **3/3** |

Two conclusions follow:

1. **Clean and evolution are saturated** for this fixture; they cannot estimate
   arm differences. Only the fault condition discriminates.
2. **The fault condition shows a provider × arm interaction**: Qwen's agent arms
   exhaust the 12-step budget without emitting a verdict, while DeepSeek's
   complete the task in 5–6 actions. This is a termination/planning boundary,
   not a mis-report.

### The honest caveat

Wilson 95% intervals for Qwen visual `[0.000, 0.561]` and DeepSeek visual
`[0.439, 1.000]` **overlap**. The difference is a directional planning signal,
not a separated estimate. n=3 cannot settle it.

## Three real defects found and fixed

1. **Benchmark-definition mismatch.** The fault mutation renames
   `Pack Mug + Framed poster`, while the task's expected product was
   `Mug The adventure begins`. Every agent arm then *correctly* reported `clean`
   and was scored as an oracle failure. The orchestrator now derives the fault
   condition's expected product from the mutation definition's `target_text`.
   The misaligned block is retained as separate evidence (`fault-r3`).
2. **Cross-SUT environment leakage.** Sourcing the Invoice Ninja profile exports
   `APP_PORT=8082`; PrestaShop's compose interpolates `${APP_PORT}:80` and the
   shell value beats the compose directory's own `.env`, so PrestaShop tried to
   bind Invoice Ninja's port and every reset failed. The lifecycle script now
   merges the application's own env file into the child environment so it always
   wins. Verified by deliberately re-exporting the conflicting value.
3. **Run-id collision across run tags.** Run ids did not include the run tag, so
   a re-run in a new execution context would collide with the previous ledger
   and the audit would report duplicates. The run tag is now part of the run id.

## D line: arbitration

The three competing figures are three **different designs**, not contradictory
measurements:

| Figure | Arithmetic | Scope |
|---|---:|---|
| 29,484 | 21,600 local + 2,700 cross-Web + 5,184 configuration replication | widest |
| 30,240 / 4,320 | 30 apps × 8 wf × 3 cond × 3 arms × 14 / × 2 | broad, deeper repetition |
| 19,000–22,000 | 5,400 + 720 + 8,400 + 2,160 + 2,295 near-term panels | narrowest |

**No repetition count is frozen and no figure is arbitrated.** The clean and
evolution conditions are at ceiling; the fault condition is discriminating but
n=3 with overlapping intervals; between-cell variance is not estimable from one
application × one workflow.

What the fault block does settle: for the **largest possible contrast**
(1.000 versus 0.000) the stratified simulation returns power 1.000 at **4
repetitions per cell** for every swept between-cell variance. That is a floor,
and it implies the binding constraint is **breadth (applications and workflows),
not repetitions** — which argues against adopting 30,240 before a second
application exists.

## C line: application admission

Invoice Ninja's independent database oracle is now implemented and verified
(`invoiceninja-database-invoice`, authority `independent-database`), and the
Playwright cell requires both the visible check and the oracle to pass. The
blocking item is now explicitly the **absence of visual/hybrid agent adapters**
for that SUT, plus an unpinned image digest. Gitea remains
promising-but-unverified with no local deployment asset.

## Verification

| Check | Result |
|---|---|
| `npm run test:contracts` | **138/138 pass** (123 at session start + 15 new) |
| `npm run validate:provider-profile` | 6 frozen profiles; executable registry coverage 8/8 |
| All 11 asset validators | pass |
| `npm run records:audit` on all 15 new ledgers | `errors: []` |
| `scripts/check-public-boundary.sh` | pass |
| `confirmatory: false` on all 15 new summaries | 15/15 |

New tests: `provider-profile-manifest.test.mjs` (8) and
`invoiceninja-oracle.test.mjs` (7), including an exact-match guard against
`LIKE '123456'` matching the sibling invoice rows and an input-escaping guard.

## Deliverables produced

Reports (`results/phase2/`):

- `2026-09-12-provider-protocol-normalization.md`
- `2026-09-12-prestashop-clean-canary.md`
- `2026-09-12-prestashop-clean-scaleup.md`
- `2026-09-12-prestashop-fault-detection.md`
- `2026-09-12-application-admission.md`
- `2026-09-12-variance-and-scale-arbitration.md`
- `2026-09-12-phase2-stratified-ledger-audit.xlsx` (3 sheets, SUMIFS aggregates)

Code:

- new: `config/provider-profile-manifest.v0.1.json`,
  `config/provider-readiness.v0.1.json`, `src/provider-profile.mjs`,
  `src/invoiceninja-oracle.mjs`, `scripts/check-provider-readiness.mjs`,
  `scripts/validate-provider-profile-manifest.mjs`,
  `scripts/prestashop-matched-pilot.mjs`,
  `scripts/evaluate-invoiceninja-invoice.mjs`, 2 contract test files
- modified: both drivers, `run-prestashop-agent-cell.mjs`,
  `run-invoiceninja-playwright-cell.mjs`, `webtestpilot-lifecycle.mjs`,
  `run-records.mjs`, `run-record.schema.json`, `power-simulation.mjs`,
  `package.json`, `application-triage-queue.v0.1.json`

## Shortfalls, stated plainly

1. **The clean scale-up reached 78 of 600 planned executions** (26 of 100
   repetitions, `aliyun` only). It was stopped because the clean condition is at
   ceiling and the fault condition needed the SUT exclusively. Resume
   instructions are in the scale-up report.
2. **The scale arbitration is unresolved.** Three figures remain in the
   codebase and `PREREGISTRATION_DRAFT.md` §H.
3. **No application is admitted**; `confirmatory admissions = 0` is unchanged.
4. **Doubao is blocked** by an account limit that requires an Ark console action.
5. **PrestaShop still has no reset digest**, unlike BookStack. The orchestrator
   records `reset_seed_counts` and `reset_digest: null` rather than inventing one.
6. The `xlsx` workbook's formulas could not be recalculated because LibreOffice
   is not installed on this host; the SUMIFS criteria were verified against the
   raw data with an equivalent Python computation.

## Recommended next work, in priority order

1. **Run the fault block at higher repetition** to separate the overlapping
   Wilson intervals — this is the single highest-value experiment.
2. **Declared step-budget ablation** for the Qwen agent arms, to determine
   whether `agent-step-budget` is a budget artifact or a capability boundary.
3. **Implement a persisted-state fault family** so the fault condition can be
   scored against the database authority instead of visible text only.
4. **Admit a second application** (Invoice Ninja agent adapters, or a Gitea
   compose stack) — breadth, not repetitions, is the binding constraint.
5. **Resolve the Doubao account boundary**, then re-run
   `npm run readiness:provider` for that stratum only.
6. **Unify the provider-id vocabulary** between the configuration registry
   (`aliyun-compatible`) and the manifest (`aliyun`).
