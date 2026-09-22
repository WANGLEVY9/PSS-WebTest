# Qwen3.8-Max official WAV expansion checkpoint

Date: 2026-09-22. Scope: local development/diagnostic acceptance. **Not a
confirmatory comparison, not 100 completed tasks per profile.** Cloud results
are outside this checkpoint. Machine-readable counts accompany this report in
`2026-09-22-wav100-progress.json`; a proposed schedule is never an execution.

## Target and actual coverage

The requested target is 100 distinct shared official WebArena-Verified task IDs
per execution profile: AgentLab Pure Visual, AgentLab Hybrid, restricted Browser
Use Hybrid, and Playwright. The three agent profiles use the `qwen3.8-max` API
alias; Playwright makes no model calls. This is **400 target executions**.

The prepared outcome-blind candidate set contains 100 of 187 single-site Shopping
tasks, covering all 48 Shopping intent templates. It is not all-site WAV coverage
and is not a replacement for the manuscript's frozen eligibility protocol.

Actual official task IDs executed here are **260 and 274**. These are the
published category-navigation and search tasks, not synthetic replacements.
Each run starts from a new owned image fixture and uses the pinned official WAV
evaluator after the browser/HAR/trace have closed. See the JSON for all attempts,
including setup-only failures, timeouts, projection failures and repeated runs.

The repaired acceptance sequence before the final tool-schema retest yielded:

| Profile | 260: Video Games category | 274: search usb wifi |
|---|---|---|
| AgentLab Pure Visual | native score 1, 2 requests/actions | native score 1, 4 requests/actions |
| AgentLab Hybrid | native score 1, 2 requests/actions | native score 1, 4 requests/actions |
| Restricted Browser Use Hybrid | native score 1, 2 requests/actions | native score 0, 24 repeated clicks, action budget exhausted |
| Playwright diagnostic script | native score 1, 0 requests, 2 actions | native score 1, 0 requests, 3 actions |

This selected latest-per-profile table is **not** a pooled success rate. Earlier
failures remain immutable. Observation timeouts, action timeouts, acquisition
policy and visual coordinate convention changed during debugging. In particular,
the successful visual run uses an explicitly declared normalized Qwen coordinate
codec, while these hybrid runs use CSS pixels. They cannot isolate a pure causal
effect of observation modality. Freeze a common policy before a comparison batch.

Final post-schema retest `qwen38max-official-wav274-browser-use-hybrid-002`
again returned native score 0 after 24 clicks at (1087, 87), without action
errors. The actor exhausted its action budget; the independent evaluator,
replay-integrity check and owned cleanup completed. Thus the key-schema fix
does not explain away this particular official-task failure. There are 15 probe
reports in total: 14 actual actor starts, 13 native-scored runs, one unscored
interrupted actor run and one setup-only attempt. They still cover just **two
distinct official task IDs per profile**, not 15 distinct tasks. All 73 recorded
official-probe API responses returned HTTP 200 with model `qwen3.8-max`; HTTP
success does not imply correct actions or successful tasks. Billed cost remains
unknown rather than zero. The synthetic control calls are outside these counts.

## Evidence-based engineering findings

1. **Coordinate contract:** the first visual task-260 run issued clicks consistent
   with normalized coordinates but executed them as CSS pixels. A separately
   versioned normalized-codec run succeeded. No action snapping, target lookup or
   post-hoc reinterpretation was used. This supports a contract issue in that
   configuration, not a general claim that every visual failure is engineering.
2. **Observation timing/projection:** capture inherited a five-second action
   timeout. One later pair differed by 300 pixels with a maximum one-level channel
   difference around a logo. Capture now has a declared bounded timeout; hybrid
   may reacquire at most three complete image/projection pairs. Every rejected
   pair and its time remain logged; accepted pairs still require exact equality.
   Pure Visual does not obtain the structured projection.
3. **Supervisor fencing:** a missing heartbeat during synchronous capture/close
   could make the lease stale and prevent sealing. The independent guard retains
   fencing; interrupted attempts were reconciled with separate append-only
   evidence, not rewritten into successes.
4. **Traditional action timeout:** the first five-second category click timed out
   after resolving an actionable element. New configurations give every profile
   the same declared 30-second action cap, still inside the task budget. The
   evidence does not identify the exact underlying browser delay.
5. **Browser Use tool contract:** a separate typing control executed text input,
   then produced `ctrl+a`, which was rejected by a whitelist that the tool schema
   had not disclosed. The schema now exposes exactly the allowed key spellings;
   typing explicitly inserts rather than silently replacing text. The revised
   real-Qwen synthetic control completed in two calls. This control counts as
   **zero official tasks**. Earlier official task-274 repeated clicks are not
   explained by an observed key error: all 24 actions were clicks without actuator
   errors, history was present, screenshots were actual image inputs, and the
   typing tool existed. Attribute that run conservatively to a model/framework
   decision-loop observation, with wider causal attribution unresolved.
6. **Non-task data egress:** Browser Use telemetry and cloud synchronization are
   explicitly disabled before import and verified, independently of the selected
   model endpoint. Raw requests, screenshots, HAR and authentication data remain
   in ignored local artifacts, not in the public results export.

## What is and is not accepted

The final offline/component verification passed 609 tests plus separately
reported real-framework and actuator component controls. Those tests make zero
model calls and zero benchmark executions. Four historical artifact-integration
test files were intentionally not requested; they are not labelled passed.

Measured bidirectional peer controls cover all rows in `review_detail` and
`customer_entity`, plus a filesystem marker, with positive mutation and fresh
restore checks. Existing container identities remained unchanged and owned
fixtures were cleaned. **This is targeted evidence, not a full inventory of all
database tables, caches, indexes, files and queues. Full-state closure remains
unproven.**

New probes separately measure reset, actor lifecycle and post-close native
evaluation. The in-session evaluation hook is not the later native evaluator;
older records lacking that separate duration retain null, not fabricated timing.
The concurrent ATA archive transfer and emulated x86 hardware also prevent these
latencies from representing isolated native sponsor-host performance.

## Why the 100-by-four campaign is not yet dispatched

- All 100 public input/setup identities have an exported authoring handoff, but
  per-task authentication policies are unreviewed. A missing `require_login`
  field does not authorize anonymous execution of account/order/address tasks.
- The manuscript baseline is independently human-authored and blind to agent
  outcomes and evaluator internals. The two probe scripts are explicitly
  **AI-assisted diagnostic scripts**, not that baseline. The 100-task handoff
  contains zero completed human scripts/reviews. The user has been asked whether
  to retain this requirement or authorize a separate AI-assisted diagnostic batch;
  no silence is treated as approval to relabel AI authoring as human work.
- Full mutable-state closure and final common framework/model/budget/coordinate
  policies must be admitted prospectively. Fixing the actor's score is not an
  admission requirement; valid failures should remain in the denominator.

Continue by resolving the baseline-authoring choice, reviewing authentication
and task-specific setup, completing the shared fixture-state inventory, then
freezing and dispatching the shared 100-task set. Do not fill the requested
count with retries of 260/274, synthetic tasks, source-label parsing or setup
failures. Report task success and testing verdict correctness separately.

## ATA and VWA

VWA local provisioning is deferred as requested. ATA has zero new official
executions at this checkpoint. Original Postmill image retrieval is active;
53,435,097,088 bytes must finish and match the published SHA1 before import.
The physical host has space even though the existing Docker VM does not.
The deployment status document specifies a separate x86 VM and warns against
assuming WAV's control API exists in the original image. Do not call a partial
archive a running benchmark. ATA FAIL cases request unimplemented functionality;
they do not require 51 separately mutated app builds (the earlier interpretation
was corrected from the original paper). Published login steps remain actor steps.

See `code/local-lab/WAV100-QWEN38MAX-PLAN.md` and
`code/local-lab/ATA-LOCAL-DEPLOYMENT-STATUS-20260922.md` for commands and boundaries.
