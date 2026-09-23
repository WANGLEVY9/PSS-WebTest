# Lifecycle timing and native evaluation contract

Recorded on 2026-09-22 for the three-benchmark manuscript design. The timing policy was checked at component level but has not passed full host acceptance. It does not relabel historical runs or invent missing timing fields.

## 1. Common time definition

New diagnostic bindings must explicitly set
`timing_policy: "actor-phase-monotonic-v1"` and four positive integer limits in
`lifecycle_limits`: `setup_ms`, `evaluation_ms`, `finalization_ms`, `transport_ms`.
Choose and freeze their numeric values on the target host before any outcome
comparison. All four profiles in a matched benchmark use the same policy,
limits, task timeout and action budget. There is no agent-only extension.

| Phase | Included in actor task budget? | Recorded evidence |
|---|---|---|
| Full SUT reset | No | Separate worker reset receipt/time |
| Context creation, reset-scoped authentication, ordered start-page loading | No | Supervisor setup window |
| Executor initialization, observations, model requests, actions, final visible observation | Yes | Actor monotonic window inside supervisor invocation window |
| VWA native live-page evaluation after actor-end | No | Separate pre-close evaluation window/receipt |
| Trace serialization, browser context close, HAR sealing | No | Finalization window |
| Child-process launch/import, envelope validation, final receipt serialization | No | Bounded transport allowance, never silently dropped |
| WAV/ATA post-close evaluation and cleanup | No | Separate worker evaluation/cleanup times |

Use `time.monotonic_ns()` for within-process intervals, never wall-clock dates
or cross-host monotonic timestamp subtraction. The actor receipt stores
`timing_policy`, `actor_timing {start_ns,end_ns,elapsed_ms}`, and `elapsed_ms`.
The supervisor seal stores contiguous setup/actor/evaluation/finalization
windows. The actor interval must lie inside the actual invocation window;
the child lifecycle must fit inside the parent-process observation. Phase
limits and transport allowance are checked, not inferred from a PASS bit.

The external actor command timeout must be **at least** task timeout + all four
administrative limits. A timeout of that envelope is an unresolved engineering/
external failure and quarantines the environment. It is not proof the actor
exceeded its own decision/action budget. An explicitly observed actor timeout
remains a capability endpoint and cannot be rescued by a later native score.

`result.phase_timings_ms.actor` remains the historical **whole subprocess**
duration for compatibility. New records additionally expose
`actor_envelope_elapsed_ms`, `actor_elapsed_ms`, and `lifecycle_timing`. Do not
plot the old field as decision/action latency. Report total wall time and
administrative overhead separately; neither disappears from efficiency costs.

Old synthetic/diagnostic records remain readable. They cannot satisfy the new
delivery gate without original phase evidence. Do not fill missing values
with zero or recreate them from aggregate runtime.

## 2. Final active page and evaluation order

The trusted actuator reports its actual final active `Page` through a
supervisor-only callback. Do not substitute the initial page, the last-created
tab, or a page selected using a guessed URL. Native evaluation begins only
after the immutable `actor-end` event. The actor never resumes afterward.
This is important because VWA HTML/image evaluation can itself navigate.

`run_owned_session(...)` accepts `native_evaluator(actor, final_page)` and
`lifecycle_limits` as **supervisor arguments**, not as actor input/prompt fields.
It runs the real actor with deferred trace finalization, persists the callback
receipt in `preclose-evaluation.json`, closes the context, and returns:

```json
{"actor_result": "original immutable actor receipt",
 "actor_lifecycle_ref": {"file": "absolute private path", "sha256": "64 hex"}}
```

The actual envelope contains objects, not the explanatory strings above.
No gold/config, page URL, HAR, reset proof, or native feedback is appended to
the actor receipt. Every returned reference is checked against execution
identity, provenance, bytes and the hash-chained trajectory.

## 3. Benchmark-specific components and remaining gates

### WebArena-Verified

`wav_native_evaluate.py` invokes the pinned upstream API on the original final
answer and finalized HAR. Native success/failure is `native_score: 1/0`;
evaluator error is unresolved, not score zero. No ATA-style verdict is supplied.

`wav_owned_lifecycle.py` supplies `--operation reset|cleanup` commands with a
pinned private manifest. It recreates only owned, mount-free shopping fixtures
from an already installed digest-pinned image. It refuses unsupported or extra
task sites; shopping is not whole-WAV admission. It never pulls images, adopts
an existing fixture or deletes an unowned container/network.

The dedicated Docker bridge disables inter-container communication and only
publishes loopback ports. It is **not** an outbound-egress firewall. The first
internal-bridge attempt exposed an actual Docker/Colima port-publication failure;
that attempt is not a successful reset. Do not waive host firewall policies.

`wav_owned_reset_probe.py` performs two controlled mutation/restore cycles on
new disposable instances (three fresh instances). Its review/customer/file
marker measurements and unchanged pre-existing container identities are
engineering evidence, **not** complete peer-data-content or per-arm admission.
The failed attempt and corrected attempt must retain separate artifact roots.

### VisualWebArena

`vwa_native_evaluate.evaluate_live` invokes the pinned official router on the
live final page. `consume_sealed` is the worker CLI entry point: it verifies
and consumes the pre-close result, never recreates a page to re-evaluate it.
Text, URL, DOM and image-SSIM positive/negative controls execute actual upstream
code. Original task/source/config bindings are verified independently.

Current judge policy is `deterministic-only-fail-closed`. Fuzzy text and VQA tasks
remain evaluation-blocked until a separate frozen native judge is configured
and audited. They are not removed from the task set or assigned score zero.

`vwa_reset_contract.py` requires a per-execution full-site measurement manifest,
task dependency closure, lease binding, state digest and health evidence for
every site. Upstream Classifieds HTTP reset is not by itself state proof.
Shopping/Reddit require a real snapshot/restore backend; browser reset or a
200 homepage is not a substitute. This module validates proof, it does not
pretend to implement those missing host-specific restore commands.

### ATA

`ata_native_evaluate.py` is deliberately labeled
`pss-ata-reference-evaluator-v1`, **not** an independently runnable native
runtime oracle. The published `evaluation.py` couples actor orchestration with
GitHub workflow dispatch against the authors' infrastructure; we do not run
it or borrow ambient GitHub credentials. A sponsor needs its own audited
fixture restore backend and original-label/live-state parity proof.

The adapter pins the original ZIP and extracted source/CSV bytes, preserving
113 records (62 PASS / 51 FAIL), source IDs, repeated step labels and failure
annotations. Public output is exactly:

```json
{"verdict":"FAIL","failure_step":2}
```

`verdict` can be PASS, FAIL or null; `failure_step` is a positive official source
step label or null and must be null unless verdict is FAIL. This public schema
is identical for every arm. No Markdown extraction, capitalization repair,
gold-guided retry or missing-verdict-as-FAIL conversion is performed.

Prediction and correctness are separate: `verdict`, `prediction_status`,
`verdict_correctness`, `confusion_class`, `step_class`,
`step_assessment_status`, `strict_step_correctness`. Positive class means a
failing test. AFB/AFC/AFA means predicted failure before/at/after the reference
step. Ambiguous labels preserve binary judgment but leave step accuracy null.
Missing/invalid verdicts stay in deployment accounting, not silently deleted.
`operational_correctness` stays null until live fixture/label parity is proven.

## 4. Sponsor rehearsal and evidence checklist

1. Install reviewed native Linux locks and official site closures. The user
   delegates VWA storage/host provisioning to sponsor staff; local component
   success is not Linux deployment evidence.
2. Freeze runtime bindings, model identity, limits, routes, sources, images,
   Traditional scripts, candidate version and the fixed development cohort.
3. Integrate owned reset-scoped context/auth setup with the worker wrapper. The
   actor command currently accepts public input only; trusted manifest/reset
   wiring must be supplied by the benchmark wrapper, never inserted into the
   model prompt. Do not claim the standalone helpers are turnkey executors.
4. Traditional scripts must emit the same timing/replay contract. Historical
   JavaScript review scripts do not automatically satisfy it. Source-authoring
   blindness and task adaptation remain separate evidence gates.
5. Run actual per-profile restore/isolation controls including unchanged peer
   **state**, not only unchanged container IDs; run native evaluator controls
   in the same deployed fixture. Never fabricate the 12 required acceptance cells.
6. Run fixed official cohorts 2 → 10 → 20 per benchmark, then prespecified
   stability repeats. Retain genuine capability failures; quarantine and
   diagnose engineering/external failures. No capability-success cutoff.
7. Re-run coverage audit and review evidence before formal authorization.

Offline commands (from repository root):

```sh
node code/experiment/sponsor-portable-verify.mjs \
  --output NEW_PRIVATE_DIRECTORY \
  --python /absolute/path/to/python \
  --framework-profile PRIVATE_DEPLOYMENT_PROFILE.json
```

The native integration group includes WAV, VWA, ATA-reference and Chromium
lifecycle controls. Missing prerequisites are failures/not-run, never green
skips. No API key, paid request, formal task execution, or paper source is
needed. Preserve failed reports; write a new directory for every retry.
