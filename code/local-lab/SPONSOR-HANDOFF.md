# GPT sponsor handoff and acceptance checklist

Status (2026-09-21): **OpenAI transport implemented and offline-tested; full benchmark handoff NOT ready.**

The user adopted manuscript v2.0 and retired the old five-configuration plan on 2026-09-21. See [DESIGN-V2-MIGRATION.md](./DESIGN-V2-MIGRATION.md) and [ANALYSIS-AND-ROUTING.md](./ANALYSIS-AND-ROUTING.md). The active matrix is 19 configurations × 12 rounds. Substantial existing collection is user-reported; GPT supplementation should reconcile original IDs/configurations first. Missing local records do not establish globally unrun tasks.

This is the handoff for `code/local-lab`, the current official-benchmark observatory. The older `code/dashboard` and legacy five-application runners are engineering assets, not interchangeable official-benchmark entrypoints. No GPT capability result, confirmatory task result, or complete three-benchmark reproduction is claimed here.

## 1. What the sponsor supplies

The default is the official OpenAI API. Supply an API key and exact model ID with **image input and strict structured JSON output** enabled. Use a versioned model ID when available and retain the returned model identifier. The project cannot infer model access from a key's shape or from `/models` alone. No particular model is silently selected.

1. Copy `local-lab/openai.env.example` to **ignored** `code/.env.openai` if it does not already exist. Never overwrite an existing credential file. Set file permission to `600`.
2. Fill `OPENAI_API_KEY` and `OPENAI_MODEL` locally. Leave `PSS_LOCAL_PROVIDER=openai`, base `https://api.openai.com/v1`, and `OPENAI_API_MODE=responses` unless the sponsor explicitly provides a different supported interface.
3. Use `PSS_LOCAL_ENV_FILE=.env.openai` for every sponsor command. This isolates the file from old Qwen keys, models, endpoints and launch switches. Restart the console after editing configuration.

Optional Chat Completions is selected with `OPENAI_API_MODE=chat-completions`, never via fallback after an error. GPT requests do not include Qwen's `enable_thinking` or assume support for `temperature`. Responses use `store:false`, `input_image`, and `text.format`; Chat uses `max_completion_tokens` and `response_format`. There are no built-in browser/web/computer tools: both arms continue to use the **PSS VLM agent** and their declared observation/action boundary.

References: [OpenAI vision inputs](https://developers.openai.com/api/docs/guides/images-vision), [structured outputs and refusal handling](https://developers.openai.com/api/docs/guides/structured-outputs). Account-specific permissions, pricing, limits and actual model capability remain live-verification requirements.

## 2. Commands on this prepared machine

Run from the repository's `code/` directory. No command below upgrades benchmark pins, provisions a cloud host, or authorizes confirmatory collection.

```bash
# No paid API requests: local browser, adapter, study contracts and ledger tests.
npm run sponsor:verify

# Local read-only service/dependency audit; exit 2 currently means BLOCKED, not a crash.
PSS_LOCAL_ENV_FILE=.env.openai npm run sponsor:preflight

# Explicitly authorize at most two image API requests using a generated synthetic image.
# No benchmark tasks, gold answers, local SUT screenshots or evaluator outputs are sent.
PSS_LOCAL_ENV_FILE=.env.openai npm run sponsor:smoke -- --live

# Read-only evidence console. Do not launch a second server on the same port.
PSS_LOCAL_ENV_FILE=.env.openai npm run sponsor:console
```

Without `--live`, the smoke command makes **zero** requests. Its image token is generated randomly, appears only in the screenshot, and is checked after the response. Both Visual and Hybrid receive the image; only Hybrid receives a small visible-control list. Successful smoke establishes image/JSON wiring only, **not multi-step agent success or benchmark admission**. Authentication, rate-limit, service, network and timeout failures stop further smoke requests. Failed output contracts remain failed evidence, not repaired answers.

The current API output cap is 1,024 tokens, request limit 45 seconds, and agent budget 24 decisions / 240 seconds. A reasoning model may spend output tokens before producing an action. Any change to `PSS_LOCAL_MAX_OUTPUT_TOKENS`, reasoning settings or wall/step budgets requires a new pilot/frozen configuration; do not enlarge only the losing arm's budget. Both GPT arms use the same selected model/configuration. Missing usage remains unknown in request records; existing dashboard token totals are reported-token subtotals, not complete billing estimates.

The model smoke does NOT set `PSS_LOCAL_ALLOW_DIAGNOSTIC_RUN=1`, edit conformance reports, or turn on per-arm reset. Existing five-batch/33-record diagnostic evidence remains immutable. Next-run protocol is `wav-retrieval-json-v7-provider-diagnostic`, separate from all historical strata.

## 3. Verified components versus remaining work

| Layer | Current evidence | Missing acceptance evidence |
|---|---|---|
| Node/browser runtime | npm direct dependencies compatible; real Chromium calibration and rendering tests | Fresh-machine installation rehearsal; pinned browser/OS configuration for final study |
| OpenAI provider | Responses + Chat request/response, strict schema, refusal/truncation/error categories, no retry, credential isolation tested offline | Real sponsor image smoke, account limits and preregistered response soak; no live GPT request yet |
| WAV source/evaluator | Official source pin and Python dependencies verified; original evaluator integration; seven exposed tasks /33 records | Answer-dependent evaluator errors require explicit handling; full dependency closure for selected tasks |
| WAV reset | Three fresh-image cycles restore six review-table hashes and leave neighbor unchanged | Reset before **every** arm/repetition in actual runner, exact task-state fingerprints and isolation proof |
| VWA | Official source and local component preparation | VM storage, deployed official site(s), reference-image input adapter, native reset/evaluator and three-arm runs; local torch platform warning persists |
| ATA | Published artifact parser, specification/gold separation and metric unit checks | 112-vs-113 inventory amendment, local fixture-label parity, reset, live shared evaluation and three-arm adapters |
| Dataset/fairness | Frozen v1.0 rules and machine-checked contracts | `included_tasks.csv` and Traditional adaptation ledger currently have headers only; independent human reviews and blinded scripts still required |
| Observability | Per-step frames/digests, actions, provider summaries, HAR, trace, durable ledger; English console | Official adapters beyond WAV retrieval, cross-adapter replay validation and tested interrupt/resume/isolation scheduler |
| Analysis | Strict completion separated from oracle score; metric unit tests, unknowns not invented | Frozen task population, pilot variance, repetitions/power plan, reviewed analysis export and authorization |

Neither an environment health response nor a unit-test pass establishes benchmark admission. The current gate remains **false in executable code**, not merely a disabled UI button. A source/config/report flag alone cannot bypass missing reset capability. No human screening sign-off is simulated as completed.

## 4. Environment and operational risks

- Host: Apple Silicon, Node 20, native ARM Chromium; Shopping runs in an x86 QEMU Colima VM. This is not native x86 hardware performance evidence.
- WAV Python is 3.12, VWA Python is separate 3.11. `uv pip check` passes WAV; VWA reports `torch` built for another platform. A range-read of the official ARM64 torch 2.0.1 wheel found the same x86_64 WHEEL label as the installed metadata, while the local native library is ARM64. This supports an upstream packaging-label discrepancy, not a demonstrated wrong binary installation. Full-wheel checksum and VQA inference are still unverified. See [detailed audit](./SPONSOR-READINESS-2026-09-21.md). Do not remove wheel metadata or silently upgrade pinned versions to obtain a green check.
- Colima VM has approximately 15.97 GB available after cleanup. The official VWA Classifieds image has a ~76.9 GB compressed lower bound; provisioning reserves/unpacked state need more. Host free disk is not VM free disk. No cloud host or disk expansion was provisioned for this handoff.
- Shopping's existing 7770/7771 bindings are wildcard-bound. The console binds loopback. Before remote/sponsor deployment, recreate a dedicated owned fixture with loopback-only bindings or verified network isolation. This audit does not establish outside-network reachability. Do not expose fixture credentials, environment-control endpoints or the observatory publicly.
- The local readiness probe now waits for **all** official services and performs one body-consuming homepage request with a 90-second provisioning timeout. This is outside all agent budgets and avoids repeated client timeouts queuing PHP work. Fresh reset homepage measurements were 48–59 seconds.
- Setup commands in `README.md` assume a prepared pinned source checkout and the named local VM. They are not a complete portable deployment of the three benchmarks. On a new machine, reproduce official per-site instructions and rerun source/runtime/reset/evaluator verification; copying a green JSON report is never admission.

## 5. Required execution sequence and acceptance criteria

1. **Provider wiring (implemented; live pending):** sponsor config → two synthetic image checks → preregistered soak (at least 30 requests per interface, response availability threshold from the frozen plan). Preserve every attempt. No task success-rate filter.
2. **Environment closure:** pinned images/assets/accounts for an outcome-blind development selection; serving content, official source/runtime parity, local-only endpoints and storage reserve verified. Apply/remove/reset checks use owned disposable fixtures only.
3. **Per-cell reset lifecycle:** exclusive environment-shard lease → reset → dependency fingerprints + native health → fresh browser → execute exactly one arm → close browser and finalize HAR → independent evaluator → append immutable record → release lease. Reset failure is pre-arm infrastructure, not CUA failure. The next cell must not start after failed cleanup.
4. **Development matched pilot:** same task/fixture/budget; model shared across Visual/Hybrid; no target hints, URL/milestone side channels, evaluator answers, static task plans or DOM snapping added to rescue failures. Persist original outcome and failure layer.
5. **Formal preparation:** recover the original pre-execution eligible/excluded IDs, human review/adjudication and blinded Traditional adaptation evidence; retain preparation failures in the denominator. Follow v2's 19 configurations and fixed 12 D/V opportunities, rather than reselecting repetitions from the retired plan. Exposed local development tasks are not an untouched confirmatory sample. Missing local provenance does not imply the original work never occurred.
6. **Long-running scheduler acceptance:** pre-generated task×repetition×configuration manifest, state-isolated shards, bounded concurrency, provider limits, checkpoint/resume without duplicate IDs, crash quarantine and budget stop tested. Current single-worker development runner is not this scheduler.
7. **Explicit runtime admission**, then gradual supplementary batches with reviewed failure attribution and sanitized exports. The active matrix is six models × three framework/input combinations plus one shared script, with 12 opportunities per selected task/configuration. Preserve original task, budget and configuration provenance when supplementing GPT; do not rerun all other models just because their data is not yet imported locally.

## 6. Storage and sharing

Private files stay in ignored `code/artifacts/local-runtime/`: benchmark HARs, screenshots, prompts, model outputs, evaluator references, smoke images, detailed test logs and machine readiness. `code/.env*` is ignored. Source/config copies and SHA-256 digests support replay; no key is copied to batch metadata. The public export includes only whitelisted readiness fields and regression aggregates, not provider base URLs, secrets, screenshots or gold data. Paper/LaTeX material remains excluded from this public repository.

Readiness is reported in layers: **offline contract passed ≠ live API verified ≠ task adapter admitted ≠ confirmatory authorized**. The sponsor can test the API connection after filling configuration; they cannot yet start scientifically valid large-scale experiments merely by adding a key.
