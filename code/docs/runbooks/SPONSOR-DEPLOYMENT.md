# Sponsor deployment and acceptance

Current operator entry: [cloud installation and capacity handoff](../../experiment/cloud-handoff/README.md), [dependency manifest](../../experiment/cloud-handoff/dependency-manifest.json), [technical design](../../../docs/technical/README.md), and [native acceptance runbook](../runbooks/ACCEPTANCE-RUNBOOK.md). This guide is an engineering deployment path; passing the doctor does not authorize a campaign or establish complete shared-budget coverage.

Latest session/authentication/isolation implementation and host-specific VWA/ATA
handoff: [Session and isolation handoff](SPONSOR-SESSION-AND-ISOLATION-HANDOFF.md).
It includes the Traditional API, task wrapper bindings, private authentication
proof schema, bidirectional full-state export protocol and unresolved live gates.

Current operational checklist: [official development acceptance runbook](../runbooks/ACCEPTANCE-RUNBOOK.md).
It defines the 60-task / four-profile / 360-opportunity development gate, public
output protocols, source mapping and measured receipt contracts. It explicitly
does not claim that the full live benchmark lifecycle is already delivered.

The dated adapter remediation report is retained in the local ignored archive. Frozen-input correspondence checks and real-framework component probes were implemented; full native benchmark and sponsor-machine acceptance remains open.

This guide is for a **new, separately identified sponsor campaign**. Previous cloud data is not a prerequisite for installing, checking or developing this environment. Do not merge new and historical results without a later provenance reconciliation. No historical result is deleted or declared nonexistent.

`config/active-study-design.json` is the historical manuscript-design pointer, not the next WAV campaign dispatcher. See `config/current-campaign.json` for the current planning status. At this revision it selects the corrected v2.1 population: WAV 600, VWA 700, ATA 113 (62 PASS / 51 FAIL); 19 configurations; D1–D2 and V1–V10; 322,164 selected execution opportunities. These are planned denominators, not counts produced by the deployment tools. The paper stays private and is not needed to install the public artifact.

## 1. Separate three kinds of configuration

| File | Contains | Must not contain |
|---|---|---|
| Active study contract | Population, configuration matrix, observation boundaries, rounds, metrics | Host paths, credentials, readiness assertions |
| Private deployment profile | Docker context, source/venv paths, image identities, measured disk reserve | API keys, gold labels, permission to start formal collection |
| Private runtime bindings | Exact model/API and framework identities, prompts/actions/images hashes, matched budgets | Silent per-arm model fallback or budget changes |

Place credentials separately in ignored `code/.env.openai`, using `experiment/openai.env.example`. Sponsor integration supplies the actual accessible model IDs; manuscript display labels are not assumed to be API identifiers.

The paper specifies *matched* budgets, not numeric deadlines. For the new campaign, choose prospective limits using separate development tasks, record the choice and freeze it **before** comparative execution. Recovering old cloud settings is unnecessary for a new campaign, but is necessary before claiming it replicates or pools with an old configuration. Do not silently inherit the old local runner's 24-action / 240-second limits.

## 2. Install the common test harness

Use a dedicated native Linux x86_64 host with locally attached storage for the SQLite ledger. Multiple worker processes on the same host are supported by that ledger; NFS/shared-folder SQLite is not a distributed scheduler. Actual CPU, memory, image expansion and per-shard storage requirements must be measured for the selected official sites; this guide does not invent a universal minimum.

From the repository's `code/` directory on a **new installation**:

```sh
npm ci
npx playwright install --with-deps chromium
```

Use Node >=20 (record its exact version), Python 3 and `uv`. Keep benchmark/framework Python environments separate: upstream constraints differ. Follow the pinned upstream setup for sites, assets, native evaluation and Python dependencies. Do not install an unrelated latest version merely to make `pip check` green.

For existing environments, audit before installing. The legacy `frameworks:build` helper can rewrite locks; **do not use it as a frozen sponsor provisioning command**. Current framework candidate locks are `config/frameworks/h-agentlab.lock` and `h-browser-use-journaled-actuator.lock`. The older Browser Use lock omits three actuator dependencies. Reproduction must compare the complete installed distribution set and versions, not a matching subset, and run import/inference checks on the sponsor OS. These local locks are not proof of portable installation or a conformant task adapter. See `DEPENDENCY-LOCK-GATE.md`.

## 3. Run offline acceptance without old data or a model key

```sh
mkdir -p artifacts/local-runtime
node experiment/sponsor-portable-verify.mjs \
  --python python3 --output artifacts/local-runtime/sponsor-offline-001
```

The output directory must be new. This runs Node contract tests, actual Chromium observation/console tests, Python ledger/recovery tests, input-projection checks and the active design validator. It does not require old cloud runs, the manuscript, a benchmark download or API credentials. It hashes relevant sources before and after testing; concurrent edits invalidate the aggregate result. It never invokes benchmark task execution or changes the execution gate. Read the recorded test counts, skips and failures, not just a progress line.

Four historical artifact-integration test files require downloaded source/generated inventory files. They are explicitly listed as `not-run` in a source-only report, not counted as passed. After obtaining those artifacts, run `--with-artifacts` in a **new** output directory to include them. Missing artifacts then fail the check; no replacement tasks are manufactured. These legacy v1 inventory tests remain distinct from active v2.1 population validation.

Outputs are private logs and an immutable `report.json`. Test fixtures are synthetic engineering evidence. No synthetic rows enter an experimental denominator. A clean-checkout rehearsal is separate evidence from tests against a prepared developer machine.

## 4. Inspect the sponsor machine using an explicit profile

Copy `config/sponsor-deployment.example.json` to a **new** ignored file, e.g. `artifacts/local-runtime/sponsor-deployment.json`. Edit paths relative to `code/` (or use absolute paths). No shell expansion is performed. Set:

- Explicit Docker context, normally `default` on a native sponsor host.
- Paths to the pinned WAV, VWA and PiNATA source checkouts.
- Separate Python executables and reviewed exact locks. Null locks deliberately remain unverified.
- Docker's actual `DockerRootDir`, a measured provisioning reserve in bytes, and a dedicated local ledger directory.
- Explicit owned container names, benchmark and immutable **local image ID** (`sha256:...`). A repository manifest digest is not interchangeable with the local image ID. Keep both in acquisition provenance.

Then:

```sh
node experiment/sponsor-portable-doctor.mjs \
  --profile artifacts/local-runtime/sponsor-deployment.json \
  --live-docker --output artifacts/local-runtime/sponsor-doctor-001.json
```

Only `info`/`inspect`, dependency/version, source and filesystem checks run. There is no pull, creation, stop, reset, install or model call. Without `--live-docker`, Docker remains unverified. Exit 2 means failed/unverified checks, not permission to bypass them. The output file must not exist.

The doctor does not assume Colima or a developer home directory. It never substitutes Mac host free space for a VM's storage capacity. Bound ports must be loopback-only; unknown/unhealthy/starting fixtures are not admitted. Container health alone cannot verify native site health, reset, evaluator behavior or complete task dependency coverage. Remote daemons require their own storage check on the daemon host.

## 5. Scientific acceptance that still must run

The development team must pass [the release acceptance plan](./SPONSOR-ACCEPTANCE-PLAN.md) **before** delivering this as a runnable full-study release. Sponsor-side verification repeats an already demonstrated path; it is not the first integration/debugging environment. An offline-green artifact without real framework/native-benchmark acceptance is a development package only.

| Gate | Required evidence | What does not suffice |
|---|---|---|
| Official selection | Official task/source IDs and attachments; outcome-blind screening; fixed selected population | Counts or an automatically generated mock task list |
| Preparation | Blinded human-authored script ledger; failed preparation retained in denominator | AI-generated development script relabeled as human-authored |
| Environment | Pinned fixture closure; authenticated state; reset before **each** arm; isolation and crash quarantine | Healthy homepage, fresh browser context, copying another machine's green report |
| Framework | Real pinned AgentLab/BrowserGym v/h and restricted Browser Use u; audited permitted observations/actions | PSS custom runner renamed as AgentLab; framework default DOM sent to visual |
| Evaluation | Native/reference endpoint semantics; positive/negative controls; ATA state and step alignment | Agent self-reported success or accuracy inferred from a response format |
| Evidence | Per-step frame/hash/action and accepted-action trace, original provider output, return-model identity, budget and all request attempts | Final screenshot or only the last successful retry |
| Metrics | Scheduled/start/scorable counts separate; RQ1 native endpoints; RQ2 fixed-denominator bounds; D/V-separated RQ3; common-block RQ4; preparation and execution cost separate | Timeout reclassified as success after observing a late oracle; omitted failed cells |

Pure visual cannot use URL/DOM/AX to make control-flow decisions. Hybrid receives only the allowed visible projection. Gold, evaluator internals and other-arm outcomes are never actor input. Do not “repair” model capability by adding privileged hints. An inexpensive post-run diagnostic model may annotate metadata, but must not affect execution, labels or the independent evaluator; actor downgrades need a separate declared experimental configuration.

After these checks, use a small nonformal **official** development selection on the sponsor environment to test the complete chain, then review and seal admission before gradually starting formal acquisition. The developer workstation's custom retrieval adapter remains diagnostic and cannot replace the paper's framework matrix.

### Diagnostic worker receipt contract

`runtime_worker.py` now emits `runtime_protocol=diagnostic-task-bound-v3`. All four adapter receipts must echo `opportunity_id`, `environment_id`, `configuration_sha256`, `lease_token` and `task_manifest_sha256`. Evaluation also echoes `evaluation_ref` and `evaluation_sha256`. Reset additionally attests the expected baseline; cleanup attests cleanup. The actor adapter must provide a recognized terminal status, boolean `budget_met` and integer `action_count`; the binding must specify positive wall-time and action budgets. Supervisor timing and action-count checks can reject an actor's claimed completion. These are trusted adapter receipts, **not fields to accept directly from a model response**.

An actor timeout or provider error remains that failure even when independent evaluation returns native score 1. Native score, actor termination, budget compliance, assessment validity and cleanup remain separate. Invalid or mismatched receipts quarantine the opportunity/environment. Identity echoes alone do not prove correct actions: the adapter still needs action-journal, observation-boundary and evaluator integration tests. Frozen task correspondence is implemented (see the adapter remediation report), but complete benchmark lifecycle and sponsor-host acceptance remain open. The additive `lifecycle_completed` field records a completed receipt/cleanup chain without asserting task success; it does not redefine `protocol_completed`. Do not enable formal collection on the strength of diagnostic worker tests.

## 6. Data and access

Configure and verify [shared API spending controls](./SPEND-CONTROLS.md) before
any paid canary. The default CNY 1,500 budget is shared across batches, with
80%/90% alerts, a 95% new-task stop and per-execution limits. A verified price
card is required; supplying an API key does not enable unpriced requests.

Keep fixtures, credentials, screenshots/HAR/prompts, evaluator references, detailed logs, cost-ledger DB/WAL and raw outputs on restricted storage. Keep the console on loopback; use SSH port forwarding instead of exposing it publicly. Back up the ledger with SQLite's consistent-backup mechanism or while quiescent, not by copying only the live `.sqlite` file while ignoring WAL. Publish only reviewed, redacted summaries with source/configuration hashes.

**Offline regression passed ≠ installed official environment ≠ conformant framework ≠ formal collection authorized.** These tools make deployment failures explicit; they do not claim that supplying an API key alone completes the remaining adapters and scientific acceptance.
