# Official benchmark development acceptance

Implementation update: [task wrapper, Traditional replay, authentication and
full-state isolation](SPONSOR-SESSION-AND-ISOLATION-HANDOFF.md). Fixture receipts
now require a verified `cross_instance_isolation_ref`; equal producer-supplied
peer digest strings alone cannot pass that gate. Live VWA/ATA acceptance remains
pending deployment-specific restore/parity evidence.

**Scope:** Historical three-benchmark development acceptance plan, recorded on 2026-09-22. Source and component checks were partial; live host acceptance was not established. For the next WAV-only campaign, use the [operator guide](../../../docs/EXPERIMENT-OPERATIONS.zh-CN.md).

This runbook complements `SPONSOR-DEPLOYMENT.md`. It does not authorize formal
acquisition. Do not merge this campaign into D1/D2 or V1–V10. The manuscript
population remains 600 WAV + 700 VWA + 113 ATA, not the development cohort below.

See `LIFECYCLE-AND-NATIVE-EVALUATION.md` for the prospective mandatory timing
policy, pre-close VWA evaluation API, ATA reference-evaluation boundary, and
the exact remaining integration/restore gates. Old whole-subprocess timing
cannot be silently reused as actor latency.

## 1. Acceptance scope and release blockers

Use 20 official development tasks per benchmark, four profiles per task:
AgentLab visual, AgentLab hybrid, restricted Browser Use hybrid, and Playwright.
Run nested cohorts of 2, 10 and 20 tasks; these are not separate opportunities.
The base cohort has 240 opportunities (`A1`). Five prespecified tasks per
benchmark have two additional independently reset repetitions (`S1`, `S2`),
adding 120 opportunities. Neither 360 planned opportunities nor an installed
framework is evidence of 360 executions.

Keep blocked tasks in the manifest. Do not replace a task after observing an
agent failure. Valid native score 0, an incorrect ATA verdict, or a valid
abstention can be usable evidence. No minimum agent success rate is required.

**Current release is not a ready-to-run full benchmark release.** Full fixture
reset/isolation and worker-ready native lifecycle integration for all three
benchmarks, reviewed Traditional scripts, matched budgets and sponsor-host
acceptance remain mandatory. The commands below prepare/check inputs and
evidence; they cannot fill those missing executors automatically.

## 2. Fresh host setup

Follow `SPONSOR-DEPLOYMENT.md` and the pinned deployment profile. Use a dedicated
native Linux x86_64 host for sponsor acceptance. Keep SQLite on local disk and
the console on loopback. Resolve and review Linux dependency locks; macOS locks
are not proof of Linux compatibility. Install the exact browser revision for
each environment. Credentials go only in ignored local env files.

Run from `code/`, with new output directories on every verification:

```sh
npm ci
npx playwright install --with-deps chromium
node experiment/sponsor-portable-verify.mjs --python python3 \
  --framework-profile PRIVATE_DEPLOYMENT_PROFILE.json \
  --output artifacts/local-runtime/verification-NEW
node experiment/sponsor-portable-doctor.mjs \
  --profile PRIVATE_DEPLOYMENT_PROFILE.json --live-docker \
  --output artifacts/local-runtime/doctor-NEW.json
```

Native WAV evaluator controls and Chromium HAR lifecycle tests are separate
integration suites run with the profile's WAV and AgentLab interpreters. A
source-only run reports them as `not-run`, not as passed or silently skipped.
Their fixtures are explicitly synthetic/offline, not actual task executions.

The doctor is read-only and exits 2 on failed/unverified checks. Never substitute
host free disk for Docker VM/data-root free disk. No command in this section
pulls benchmark images, restores fixtures, or calls a paid actor model.

For VWA provisioning, follow `VWA-FIXTURE-DEPLOYMENT.md`. Its separate profile
binds all fixture files, private credentials and immutable image digests. Do not
extract SQL or generated logs into the official source checkouts. The old
no-profile `prepare-vwa` command is intentionally rejected before Docker calls.

## 3. Prepare official inputs and freeze the development manifest

Use clean upstream checkouts pinned by `prepare_navigation_runtime.py` and the
reviewed ATA source catalog. Create `artifacts/local-runtime` if it is absent.
Replace `NEW` with one unique campaign suffix; do not overwrite earlier outputs.

```sh
python3 experiment/prepare_navigation_runtime.py --benchmark wav \
  --source artifacts/benchmark-snapshots/webarena-verified \
  --output artifacts/local-runtime/wav-inputs-NEW
python3 experiment/prepare_navigation_runtime.py --benchmark vwa \
  --source artifacts/benchmark-snapshots/visualwebarena \
  --output artifacts/local-runtime/vwa-inputs-NEW
python3 experiment/prepare_official_runtime.py \
  --source artifacts/benchmark-snapshots/ata-zenodo/ISSTA_ARTEFACT/benchmark \
  --output artifacts/local-runtime/ata-inputs-NEW
python3 experiment/prepare_acceptance_cohort.py \
  --wav artifacts/local-runtime/wav-inputs-NEW/task-bindings.json \
  --vwa artifacts/local-runtime/vwa-inputs-NEW/task-bindings.json \
  --ata artifacts/local-runtime/ata-inputs-NEW/task-bindings.json \
  --seed pss-dev-acceptance-v1 --campaign-id YOUR_UNIQUE_CAMPAIGN \
  --output artifacts/local-runtime/cohort-NEW.json
```

Selection consumes only prepared source bindings, not execution outcomes. It
round-robins metadata strata, then uses a deterministic seeded hash within each
stratum. WAV/VWA strata cover sites, multiple start pages and supplied images;
ATA strata cover application and published PASS/FAIL class. This is purposeful
engineering coverage, NOT a population-representative sample or completed
independent screening. Historical task exposure remains explicitly unknown.
Task IDs stay fixed when paths are regenerated on another host, while file and
manifest hashes are host-specific: never reuse another host's green receipts.

ATA has 113 published cases, 62 PASS and 51 FAIL. One source case has repeated
step display labels `[1,1,2,3,4,5]`. Preserve order and labels, rather than reject,
renumber or relabel it. Execution position and source step label are distinct.
Any ambiguous failure-step alignment must remain unresolved pending review.

## 4. Native protocol and mapping checks

WAV actors receive the same public `FinalAgentResponse` protocol through
`public_output_instruction('wav')`. Script authors must receive that same public
protocol, never expected responses/evaluator internals. Keep the final answer
unaltered and pass it to the pinned native evaluator. Do not repair a response
after inspecting the correct answer. `native_eval_contract.wav_endpoint` maps
official task status `error` to unresolved/null while preserving its original
status and score; mixed evaluator scores `[1,0]` mean failure, not success 0.5.
This helper alone is NOT an evaluator. `wav_native_evaluate.py` is the actual
official API bridge; it verifies the installed package's Python sources against
the pinned checkout, the official dataset/task, environment configuration, and
an independently sealed closed-context HAR. It does not prove reset/isolation.

```sh
PATH_TO_WAV_PYTHON experiment/wav_contract_probe.py \
  --source artifacts/benchmark-snapshots/webarena-verified \
  --output artifacts/local-runtime/wav-contract-NEW.json
python3 experiment/vwa_task_mapping.py \
  --source artifacts/benchmark-snapshots/visualwebarena \
  --port-tasks PATH_TO_INSTALLED_VISUALWEBARENA/test_raw.json \
  --output artifacts/local-runtime/vwa-mapping-NEW.json
```

The first command invokes actual upstream parser/aggregation classes with
synthetic controls. The second compares ALL task fields including evaluator
configuration; only task IDs and the documented homepage image prefix are
normalized. It maps all 910 original site-scoped tasks to port global IDs and
pins original image bytes. Both are offline checks, not task runs. Keep mapping
and evaluator data private and outside model input.

Do not use a framework wrapper's default score, hidden early termination, SoM,
URL, DOM or evaluator feedback merely because it is the default upstream path.
Pure visual remains pixel-only. Hybrid gets only the allowed visible projection.
VWA captioning/VQA/judge dependencies are independent from the actor provider.

The WAV bridge takes `--manifest FILE --manifest-sha256 SHA` and worker JSON on
stdin. Its `pss-wav-native-evaluator-v1` manifest contains `scope`, `source_dir`,
`source_commit`, `source_dataset_sha256`, `environment_config_ref`,
`network_trace_root`, and `private_artifact_root`. The environment config must
explicitly refer to the pinned official dataset, never an implicit fallback.
Native results and logs may contain gold and remain private 0600 files.

## 5. Runtime integration contract

Before running the cohort, freeze a private binding for each benchmark/profile:

- exact model/API ID and framework revision; no silent model fallback;
- observation mode, coordinate units, viewport/browser/locale/timezone;
- identical per-task action and time budgets across methods;
- prompt/action/source hashes, zero hidden SDK retries;
- request cost cap and per-request reservation;
- full fixture baseline and isolated environment identity;
- pinned executable commands for reset, actor, native evaluation and cleanup.
- `actor_source_refs`: all 13 files listed in `acceptance_coverage.FRAMEWORK_SOURCES`
  for AgentLab/Browser Use, or `traditional_script_ref` for Playwright. Each is
  an independent `{file,sha256}` reference to frozen source, checked against the
  actual replay `source-snapshot`. A boolean source-stability claim is insufficient.

Existing `runtime_worker.py` validates bound inputs and commands, then performs
reset -> actor -> evaluate -> cleanup. A trusted actor receipt must include its
termination, action count and budget accounting. Each receipt echoes
`opportunity_id`, `environment_id`, `configuration_sha256`. Model output is NOT
trusted to supply these fields.

`benchmark_actor_lifecycle.run_owned_session` combines trusted initial context,
native actor execution and HAR finalization. The actor command returns the
envelope `{actor_result: ORIGINAL_ACTOR_RECEIPT, actor_lifecycle_ref: PINNED_REF}`.
The worker verifies the separate lifecycle seal and forwards that reference to
the evaluator. Never append HAR fields to, or rewrite, the actor-end receipt.
HAR, hidden URLs, reset setup and gold are supervisor-only, not model input.
The legacy unwrapped diagnostic receipt remains accepted by the worker but
cannot satisfy WAV lifecycle/evaluator admission.

Every producer must explicitly preserve `scope` and `data_kind`. A synthetic
probe remains `synthetic / SYNTHETIC_TEST`; only actual diagnostic task runs use
`diagnostic / MEASURED`. Adding a label to a historical or synthetic receipt is
not a legitimate migration. The coverage audit rejects such component labels
even if an outer summary claims a measured run.

The new `lifecycle_completed` means the receipt chain and cleanup completed.
It does not replace `protocol_completed` (actor explicitly completed within
budget), native outcome, assessment validity or attribution. A provider error
can complete a lifecycle without producing capability evidence. Cleanup failure
or uncertain mutations quarantine the environment. Do not automatically rerun
an expired, already-started lease.

Traditional human-authoring/blinding requirements still apply to formal work.
AI-written debugging scripts must be labeled diagnostic and cannot be relabeled
as blinded human-authored evidence. Preserve adaptation failures in the planned
deployment denominator.

## 6. Evidence package and coverage audit

`acceptance_coverage.py` requires a private `pss-development-coverage-v1` package:

- `manifest_ref`: `{file, sha256}` of the frozen cohort;
- actual `host_id` and sealed `candidate_version`;
- `runtime_binding_refs`: `{ "wav/agentlab-visual": {file,sha256}, ... }` for
  all 12 benchmark/profile pairs;
- `execution_receipts`: pinned JSON references, one per task/profile/repetition;
- `fixture_package_ref`: pinned `pss-benchmark-acceptance-v1` fixture package.

Execution receipts contain campaign/host/protocol/candidate identity,
manifest/task-binding/runtime-binding/configuration hashes, exact model binding
(null for Playwright), task/profile/repetition/opportunity/environment IDs,
`scope=diagnostic`, `data_kind=MEASURED`, worker `result`, failure attribution and
artifact references. Artifacts are JSON receipts for reset, actor, native
evaluation, replay, cleanup, failure review, and agent provider accounting.
They must refer to actual executions, never be generated from this documentation.

Reset/actor/native-evaluation/cleanup/failure-review receipts share execution
identity and explicit diagnostic/MEASURED provenance. Native outcomes must equal
the result summary, and benchmark/task/source/evaluation-reference fields must
match the frozen task. The failure review
includes reviewer identity, rationale and pinned evidence refs. Provider
accounting contains execution/model identity, number of requests and whether
all attempts have settled (billing can remain unknown). Replay evidence uses
`schema=pss-replay-evidence-v1`, `trajectory_ref`, execution identity/provenance,
and `integrity_audit` containing the full original `replay_audit.audit` result.
The audit independently recomputes the chain, frames, actions, source snapshots
and exact actor-end receipt. WAV additionally requires `artifacts.actor_lifecycle`,
the same lifecycle ref in the native receipt, and matching source HAR hashes.
File hashes prove consistency, not honesty: retain independent review.

```sh
# Empty baseline: EXPECT exit 2 and 0/360 execution coverage.
python3 experiment/acceptance_coverage.py \
  --manifest artifacts/local-runtime/cohort-NEW.json \
  --host-id ACTUAL_HOST --candidate-version ACTUAL_CANDIDATE_VERSION \
  --output artifacts/local-runtime/coverage-empty-NEW.json

# After real measured receipts exist:
python3 experiment/acceptance_coverage.py --package PRIVATE_COVERAGE_PACKAGE.json \
  --output artifacts/local-runtime/coverage-measured-NEW.json
```

The audit rejects duplicate candidate opportunities rather than selecting a
best attempt. Engineering/provider failures, missing evidence, mismatched
models/budgets and wrong-host receipts do not pass. Valid negative outcomes can
pass structural evidence checks. Unknown attribution is explicit, never proof
of incapability. A 12-cell fixture report alone cannot satisfy task coverage.
No audit command automatically unlocks formal collection.

## 7. Failures, storage and sponsor handoff

For each failure, inspect first divergence, screenshots, accepted vs attempted
actions, raw model response, request status, reset proof and native outcome.
Separate engineering, external, capability, budget and unknown. Repair only
the implementation contract; do not add task-specific answers or privileged
observations. Retain failed attempts and costs. A repair changes candidate
version; confirm the final cohort under a sealed version rather than mixing
selectively successful reruns. If the cohort exposes missing environments,
record blockers instead of silently replacing it with available sites.

Store task/evaluator data, traces, HAR, request bodies, auth state and ledger on
private disk. Use append-only attempt records and exclusive-create outputs.
Back up SQLite consistently with WAL, and verify artifact hashes after transfer.
Publish only reviewed aggregate counts/hashes and redacted issues. Never commit
paper sources, `.env`, cookies or screenshots containing credentials.

The console publishes coverage only from a hash-bound private
`artifacts/local-runtime/acceptance-index.json` pointer with schema
`pss-console-acceptance-pointer-v1`, `report: {file,sha256}` (relative to this
store), and `published_at`. It displays planned, received, evidence-ready and
fixture-ready counts separately. It exposes no task gold or private file paths,
never launches tasks or modifies admission, and rejects stale/drifted snapshots.

Release requires: 360 task-level evidence rows, all 12 fixture cells, resolved
systematic engineering problems, fixed runtime bindings, sponsor-host fresh
install and official-task/API acceptance, and independent scientific admission.
Do not describe blocked engineering validation as a confirmatory result.
