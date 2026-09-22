# Native framework driver and Qwen3.8 diagnostics — 2026-09-22

This continues `SPONSOR-ADAPTER-PROGRESS-2026-09-22.md`. The active scientific
design remains manuscript v2.1: 600 WAV + 700 VWA + 113 ATA selected tasks,
19 configurations, 12 rounds. **No formal acquisition was authorized. No
official benchmark task was executed in this iteration.** The earlier cloud
data and all unsuccessful local diagnostic records remain unchanged.

## Implemented and exercised

- `native_framework_driver.py` connects the **real AgentLab GenericAgent** or
  **real Browser Use get_model_output** to the shared, journaled actuator.
  Browser Use's unsafe stock observation loop remains disabled. This is a PSS
  restriction/adaptation of those frameworks, not a claim to reproduce their
  published default-agent scores.
- `framework_actions.py` parses single literal actions without `eval`/`exec`.
  Coordinate clicks, typing, keys, scrolling, history back/forward, popup focus,
  explicit tab focus/close, and public task-image uploads are implemented.
  An upload opens the native chooser by coordinates and supplies pinned task
  bytes. Arbitrary paths, hidden-input selector shortcuts and page JS tools are
  unavailable to the model. Pages have stable creation-order ordinals, never
  model-facing URLs/titles. No tab count or URL is used for model progress.
- `framework_model.py` reserves every real provider attempt in SQLite before
  network dispatch, checks the frozen model/lease, and records a single attempt
  without SDK retries, model fallback or answer repair. Unknown billed cost
  remains null, consuming the full reservation, rather than being shown as free.
  The OpenAI/compatible transport uses existing private credentials; no keys
  are copied to configuration examples, prompts, traces or public evidence.
- `journaled_browser.py` stores actual PNG observations, observation/action
  timestamps, raw framework actions, decoded CSS actions, generic execution
  errors, a hash-chained append-only event log, and private URL evidence.
  Request images are deduplicated by hash. Native Playwright trace and HAR are
  retained. URL/HAR/trace metadata is evaluator/replay-only, not actor input.
  Source snapshots and installed framework/browser-library versions are saved.
- Hybrid uses a conservative visible projection and brackets extraction with
  screenshots. Visible iframes/shadow roots currently fail closed; this is an
  explicit remaining coverage limitation, not proof those tasks are impossible.
  Pixel-only never calls the projection producer. No selector/DOM correction or
  task-specific target hint was introduced for Pure Visual.
- `prepare_navigation_runtime.py` prepares separate actor/evaluator/setup
  files from the **pinned official source**. All 812 WAV candidates (53 with
  multiple start pages) and 910 VWA candidates (62 with multiple start pages;
  346 image attachments) were prepared. These are source inventories, **not**
  replacements for the 600/700 final eligible sets or completed screening.
  ATA's existing 113-case preparation is preserved.
- Two VWA files named `.png` contain GIF data (`reddit:33`, `reddit:199`). MIME
  detection now follows bytes. Model-view encoding matches the pinned VWA
  `run.py` + `browser_env/utils.py:pil_to_b64`: PIL initial frame saved as PNG.
  Original GIF bytes remain separately available for uploads. No task was
  dropped or silently reduced to text-only input.
- `benchmark_task_session.py` verifies execution/reset identity, pinned setup,
  all declared task sites, route bindings, and required authentication before
  creating fresh contexts and ordered start pages. VWA starts on the **first**
  page, matching its official environment. This is an integration API; receipt
  consistency does not substitute for measured complete-fixture restoration.
- `replay_audit.py` detects drift, incomplete actions/requests and broken event
  chains. The sponsor verifier now includes real Chromium actuator probes.
  The installer has an explicit `--install-browser` option tied to its reviewed
  Playwright pin. A separate Browser Use actuator lock retains the old lock.

## Root causes found during actual connectivity work

1. AgentLab's pinned Chromium binary was absent; Browser Use's environment lacked
   the outer actuator's Playwright dependency. Both were installed. Both actor
   environments now use Playwright 1.44.0 / Chromium build 1117 for these checks.
2. Disabling both AgentLab format examples omitted the `<action>` grammar even
   though its native parser still required it. The model's initial plain upload
   action was rejected. The prompt now discloses the actual parser grammar;
   the parser itself was not relaxed or the returned answer repaired.
3. Pure Visual repeatedly produced y=258 for a button around y=181 in a 700px
   image. That corresponds to normalized Qwen coordinates. An explicit,
   per-run `qwen-0-999` codec now maps point x/y by `coordinate * size / 1000`;
   scroll distances stay CSS pixels. Hybrid boxes use the same declared space.
   CSS and normalized runs are different diagnostic strata. No per-answer unit
   guessing, DOM snapping, retrospective rescoring or provider fallback occurs.
4. Calling `asyncio.run` on the sync Playwright thread conflicted with its running
   event loop. Browser Use decision calls now run on a dedicated decision thread.
5. The initial hybrid projection overwrote `<button>` text with its empty value;
   a real browser fixture caught it. Input-button and ordinary-button names are
   now handled separately. Empty-action field schemas were also regression-fixed.
6. One normalized AgentLab Hybrid request ended with `finish_reason=length` at
   1,024 output tokens. That failure remains in the evidence. The final matched
   **engineering** check froze 2,048 tokens for all three agent profiles, with
   the same 150-second / 10-action task budget. Formal budgets are not changed.
7. The older PSS JSON smoke received arrays despite requesting an object; six
   HTTP-200 responses did not pass its strict action contract. These failures
   are retained. Successful native-framework tests do not retroactively pass
   that legacy protocol or establish provider strict-schema compliance.

Official model/API references:
[Qwen3.8-Max capabilities](https://help.aliyun.com/en/model-studio/qwen3-8-max),
[Qwen coordinate convention](https://help.aliyun.com/zh/model-studio/vision).
The provider returned `qwen3.8-max`; the alias is recorded, not assumed immutable.
Any later confirmatory campaign needs its exact approved model binding.

## Final live engineering check (synthetic task, real Qwen provider)

Task: upload the supplied image, open the review popup, confirm the upload and
return an unpredictable code read from that page. Each profile has its own
local server state, browser, ledger and journal. This is **not a benchmark task**.

| Profile | Completion + exact upload + answer | Requests/actions | Observation frames |
|---|---|---:|---:|
| AgentLab Pure Visual | Passed | 3 / 3 | 4 |
| AgentLab Hybrid | Passed | 3 / 3 | 4 |
| Browser Use restricted Hybrid | Passed | 4 / 4 | 5 |

These single diagnostic runs are not success-rate estimates or causal proof
that all historical failures were engineering failures. Across this iteration,
31 native-framework API attempts and six legacy smoke attempts were made.
All earlier failures are retained and exported alongside final successes.
Local raw evidence lives under `code/artifacts/local-runtime/driver-remediation-20260922/`
and is ignored by Git. Public evidence contains summaries/hashes, not raw
screenshots, prompts, provider bodies, credentials or benchmark gold.

Regression acceptance: 448 tests (108 Node/browser, 284 source contracts,
53 Python runtime, 3 ATA projection), plus native-framework component checks
and 14 Chromium actuator checks. Historical artifact tests remain explicitly
not run, not counted as passed. All three final replay integrity audits passed.

## Not yet complete — do not unlock acquisition

| Benchmark | Actual remaining live acceptance |
|---|---|
| WAV | The earlier isolated reset proves six review-related tables only. Full selected-task dependency closure, per-profile runs and native positive/negative/error evaluator controls remain. Shopping availability is not all-site readiness. |
| VWA | Official Classifieds image is not deployed. The VM had 15,965,061,120 bytes free; the previously resolved official image is 76,861,304,894 compressed bytes, below even the download lower bound. Native reset, required captioner/VQA evaluation, and per-profile acceptance remain. |
| ATA | Published parser/metric and input separation do not establish the local fixture's PASS/FAIL and failure-step truth. Do not point the original evaluator at shared public sites or dispatch its remote reset workflows. Local fixture-label parity and independent per-profile evaluation remain. |

The new driver must still be integrated with measured benchmark lifecycle
executors and their native evaluation/response contracts. `run_actor` alone is
not a worker-ready full benchmark adapter. Native-session setup accepts only
diagnostic/synthetic scope; existing formal guards remain unchanged. Missing
environment, authentication, unsupported observations and evaluator errors must
not be relabeled as model incapability or removed from the deployment ledger.

Sponsor order: provision official fixtures with sufficient **Docker VM/native
data-root** disk, resolve a reviewed native-Linux lock (the macOS lock is not a
Linux lock), prove reset/isolation closure, exercise native evaluator controls,
run small official development tasks for every profile, then review campaign
selection, blinded Traditional adaptation, fixed budgets and admission.

## Reproduce locally (from `code/`, NEW output paths)

```sh
node local-lab/sponsor-portable-verify.mjs --python python3 \
  --framework-profile config/sponsor-deployment.example.json \
  --output artifacts/local-runtime/check-NEW

PYTHONDONTWRITEBYTECODE=1 ANONYMIZED_TELEMETRY=false \
BROWSER_USE_VERSION_CHECK=false LITELLM_LOCAL_MODEL_COST_MAP=True \
../third_party/frameworks/h-agentlab/bin/python local-lab/framework-live-smoke.py \
  --framework agentlab-browsergym --mode visual --model qwen3.8-max \
  --coordinate-space qwen-0-999 --max-output-tokens 2048 \
  --output artifacts/local-runtime/qwen-check-NEW --live

python3 local-lab/replay_audit.py \
  artifacts/local-runtime/qwen-check-NEW/trajectory
```

Use `--mode hybrid` for AgentLab Hybrid. For Browser Use use its Python
environment and `--framework browser-use-restricted --mode hybrid`. The live
flag authorizes at most ten provider requests for this synthetic task only.
Without it, no request is made. No command here authorizes official acquisition.
