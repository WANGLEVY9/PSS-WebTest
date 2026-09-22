# Sponsor adapter remediation: 2026-09-22

Authority: active manuscript v2.1, including ATA 113 (62 PASS / 51 FAIL).
This is engineering/source preparation, not benchmark success or formal
acquisition. Previous cloud evidence is not required or relabeled.

## Implemented

- `study-workflow.mjs plan` exports `schedule-freeze.json` alongside the complete
  19-configuration, 12-round schedule. It pins exact JSONL/source bytes and task
  metadata. `bind_runtime_plan.py --freeze ...` checks opportunity identity,
  D/V assignment, matrix cardinality, framework identity, official task/source
  correspondence and the input hash frozen with that task. Diagnostic work can
  no longer use the old unbound-input bypass. Synthetic fixtures alone retain
  a compatibility path. Hash binding does not replace outcome-blind screening.
- `runtime_inputs.py` rejects extra nested fields, preserves ATA public
  assertions without outcome annotations, embeds pinned task images, and binds
  evaluator references separately. The worker rechecks input integrity before
  reset. This detects drift, not malicious trusted adapter code.
- `framework_agentlab.py` calls the real installed GenericAgent with projected
  observations and native BrowserGym actions. No stock `set_benchmark` or
  preprocessing may overwrite the boundary. `max_retry=1` means one parser
  attempt, not one additional API retry. A separately audited model backend is
  still required to prevent hidden SDK/transport retries.
- `framework_browser_use.py` calls real Agent.get_model_output with restricted
  native tool schemas. It provides the hybrid projection and screenshot, rejects
  multiple actions instead of silently truncating, and blocks stock `.run()`.
  This is a decision/tool component, **not a complete benchmark adapter**.
- `framework-native-probe.py` exercises both frameworks with injected
  deterministic model responses. Default Browser Use URL exposure is a negative
  control. No API calls or benchmark tasks occur.
- `prepare_official_runtime.py` prepares all 113 pinned ATA cases into separate
  private actor/evaluator files and a task manifest. No relabeling or balancing.
- `benchmark_acceptance.py` audits 12 cells: WAV/VWA/ATA crossed with AgentLab
  visual, AgentLab hybrid, Browser Use hybrid and Playwright. It requires
  same-host/campaign measured receipts, evidence hashes, mutation/reset cycles,
  unchanged peers, native evaluator controls, replay, budgets and provider
  evidence. Method success is NOT an admission criterion. Receipt consistency
  does not prove its contents; scientific review remains separate.
- `bootstrap_sponsor_framework.py` plans by default and, with explicit
  `--execute`, installs a NEW environment on native Linux x86_64 only. Supply a
  reviewed lock SHA256, absolute Python/uv executables and new output/venv paths.
  Existing environments and macOS-only locks are rejected. It does not copy keys,
  rewrite locks, provision fixtures or authorize runs. Linux installation remains
  unverified until actually executed on the sponsor host.

## Source findings that prevent premature admission

1. Installed BrowserGym WebArena loads `webarena/test.raw.json` and the original
   `webarena.evaluation_harness`, NOT WebArena-Verified. Identical numeric task
   IDs cannot establish equivalence. WAV must retain its Verified source,
   native response/HAR evaluator and site lifecycle.
2. Default Browser Use includes tab URLs. Removing one prompt field does not
   remove structural loop detection, extraction, file tools or action schemas.
3. VWA reference images are task inputs distinct from screenshots. Missing
   images are input failures, not permission to substitute a text-only task.
   Upload/multitab workflows are not covered by these narrow components yet;
   do not silently exclude them or claim coverage.
4. Hybrid visibility remains a producer obligation. Schema checks do not prove
   occlusion, iframe or shadow-DOM correctness. Live observation audits remain.
5. Existing macOS locks contain `pyobjc-*`; they are not portable Linux locks.
   Resolve/review a native Linux lock in a NEW environment and record platform
   differences, never silently skip dependency pins.

Primary references: [AgentLab](https://github.com/ServiceNow/AgentLab),
[BrowserGym](https://github.com/ServiceNow/BrowserGym),
[Browser Use](https://github.com/browser-use/browser-use). Checks use locally
installed source/version identities rather than assuming upstream HEAD matches.

## Commands (from code/)

```sh
node local-lab/sponsor-portable-verify.mjs --python python3 \
  --framework-profile config/sponsor-deployment.example.json \
  --output artifacts/local-runtime/sponsor-check-NEW

python3 local-lab/prepare_official_runtime.py \
  --source artifacts/benchmark-snapshots/ata-zenodo/ISSTA_ARTEFACT/benchmark \
  --output artifacts/local-runtime/ata-bound-inputs-NEW
node local-lab/study-workflow.mjs plan \
  artifacts/local-runtime/ata-bound-inputs-NEW/source-bundle.json \
  artifacts/local-runtime/ata-schedule-NEW

python3 local-lab/bind_runtime_plan.py \
  --plan artifacts/local-runtime/ata-schedule-NEW/opportunities.jsonl \
  --freeze artifacts/local-runtime/ata-schedule-NEW/schedule-freeze.json \
  --bindings artifacts/local-runtime/private-executor-bindings.json \
  --output artifacts/local-runtime/bound-opportunities-NEW.jsonl
```

Use a private deployment profile with actual sponsor paths, not the example,
on the sponsor host. Outputs must not already exist. `task-bindings.json`
intentionally contains no fabricated executor paths or freeze hash: fill the
reviewed freeze file SHA256 and actual per-configuration/benchmark executors.
The general task driver, full reset, evaluator/replay adapters and GPT API
integration are **not completed by these commands**; worker remains diagnostic.

## Remaining acceptance sequence

1. Finish native benchmark observation/actuator adapters, including images,
   uploads, multipage workflows and trace persistence, and model request ledger.
2. Run dependency-closure reset on dedicated fixtures for each benchmark,
   checking peers and fresh actor/browser memory before each arm/repetition.
3. Run native positive/negative/error evaluator controls and small official
   development tasks for every profile. Valid method failures remain outcomes.
4. Install reviewed native Linux locks/images on the sponsor x86 host; run
   doctor, offline/native probes and official task/API checks there. No sponsor
   host is connected in this iteration, so remote acceptance remains unverified.
5. Enable formal acquisition only after separate scientific admission, blinded
   Traditional preparation, reviewed selection and frozen budgets. Do not remove
   the diagnostic guard merely because engineering tests pass.
