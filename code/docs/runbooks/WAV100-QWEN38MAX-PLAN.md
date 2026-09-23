# Qwen3.8-Max: 100 official WAV tasks per execution profile

## 2026-09-22 paired Max/Flash acceptance update

The operator campaign is now WAV-only; ATA/VWA sections below are historical
context, not deployment instructions. `wav_official_acceptance_probe.py` accepts
an explicit `--model qwen3.8-max` or `--model qwen3.8-flash`. The configuration,
request binding and report retain the chosen identity; there is no model fallback.

`run_wav_qwen_pair.py` prepares a bounded diagnostic sequence for official tasks
260 and 274: two models × three agent configurations, plus one model-free shared
Playwright baseline per task, totaling 14 planned executions. This is not the
100-task campaign and does not change its closed admission gates. Model API
aliases are recorded as aliases, not immutable snapshots. A source/input digest
change stops later dispatch; every process uses a new owned fixture and output
directory. External/provider or engineering failure stops the batch; native
score zero alone does not. There are no automatic retries or task substitutions.

From `code/`, prepare pricing without a model call:

```bash
node experiment/prepare-qwen38-spend.mjs artifacts/private/qwen38-policy.json
```

Run the paired driver from repository root with actual validated private inputs:

```bash
python3 code/experiment/run_wav_qwen_pair.py \
  --manifest /absolute/private/owned-fixture-manifest.json \
  --peer-proof /absolute/private/measured-peer-report.json \
  --bindings /absolute/private/official-wav-task-bindings.json \
  --spend-policy /absolute/private/qwen38-policy.json \
  --output /absolute/private/new-paired-output
```

Default is plan-only. Adding `--live` provisions fixtures and may charge API usage;
it requires validated local inputs and explicit authorization. `plan.json`,
append-only `events.jsonl`, per-execution `report.json`/trajectories, and final
`summary.json` retain attempts and blocked/unstarted cells. A partial batch is
never reported as complete. Shared-script evidence is referenced by both model
comparisons but never counted as two independent script executions.

This is a requested **development/diagnostic** campaign, not a replacement of
the manuscript's 19-configuration/12-round design and not confirmatory collection.
The shared set contains 100 different official task IDs, not 100 retries.

## AI-assisted diagnostic authorization (2026-09-22)

The user explicitly approved AI-assisted Traditional script authoring for this
diagnostic batch. `config/wav100-ai-authoring-authorization.v1.json` binds that
permission to the unchanged 100-task plan hash. It does not alter the manuscript's
human-authored baseline, authorize reading evaluator gold or copying agent
solution traces, or waive authentication/isolation/budget gates. No runtime LLM
calls are permitted in the Traditional arm. Known prior author exposure is
declared; independent human blinding is not claimed. The previous report's
pending authorization question is now resolved, not a current blocker.

`prepare_wav100_ai_scripts.py` verifies the public task/setup bindings and creates
a separate 100-row adaptation ledger. Its first seven navigation/search/sort
script proposals pass static facade checks, not live validation. Remaining
tasks are still PENDING, never disguised as empty successful scripts. Account
tasks require authentication review; all full-batch admission gates remain shut.
Task 261 is additionally available for bounded four-profile acceptance, requiring
the authorization file and its SHA256 on every profile, not just Traditional.
This remains an anonymous public-navigation diagnostic, not account-state parity.

The initial task-261 Traditional script timed out on a non-visible category link.
A separately pinned two-click repair (`config/traditional-proposals/wav261-category-repair-v2.py`)
was authored from its own initial screenshot, not Agent task-261 traces. Use
`--traditional-script-file` and `--traditional-script-sha256` only with authorized
task-261 Traditional probes. The previous failure remains intact; this is a new
diagnostic configuration, not replacement success or a frozen comparative arm.

An additional v3 proposal uses the visible Electronics top-level menu's hover
interaction before clicking Headphones. The Traditional facade now exposes
Playwright hover through the same action budget, deadline, screenshot and trace
instrumentation. It does not force-click hidden controls or jump to a gold URL.
Both v2 and v3 proposal sources are retained; neither is marked live-passed by
source preparation. Later evidence must identify the exact script hash tested.

Before executing v3, the original Traditional trace showed that Magento menu
hydration changes these anchors from implicit link roles to `menuitem` roles.
The queued v3 run was cancelled before launch; no benchmark execution is counted.
The v4 repair therefore waits for `menuitem` Electronics, hovers it and clicks
`menuitem` Headphones. This is derived from the Traditional trace's DOM, not a
reference answer URL or an Agent solution. The unexecuted proposals remain
available for provenance; only actual reports establish runtime outcomes.

```bash
python code/experiment/prepare_wav100_ai_scripts.py \
  --plan code/config/wav-qwen38max-100-development.v1.json \
  --authorization code/config/wav100-ai-authoring-authorization.v1.json \
  --bindings /absolute/private/official-wav-task-bindings.json \
  --output /absolute/private/new-ai-diagnostic-authoring-pack
```

## Fixed public candidate set

`config/wav-qwen38max-100-development.v1.json` records 100 tasks from the 187
single-site Shopping tasks in the pinned WAV source. It covers all 48 Shopping
intent templates: smallest task ID per template, then deterministic hash ranking
for the remaining slots. Only public task fields enter selection. Source answers,
evaluator outcomes and CUA/Hybrid outcomes are not selection inputs. The known
previously exposed seven IDs are flagged; this is not an unseen confirmatory set.
The single-site subset does not establish generalization to other WAV sites.

Target: AgentLab visual 100; AgentLab hybrid 100; restricted Browser Use hybrid
100; Playwright 100. The first three use the `qwen3.8-max` API alias; Traditional
has no runtime model. 400 is a target, not a measured execution count.

## Acceptance sequence

1. Verify source/image/dependency identities and own loopback-only fresh fixtures.
2. Run measured mutate/reset and peer-content probes. The current two-table and
   marker control is **targeted**, not full mutable-state closure: Redis, search
   indexes, other database tables, object storage and queues are not certified.
3. Use `wav_official_acceptance_probe.py` for bounded official public-navigation
   tasks 260, 261, 274 and 324:
   independent fresh rootfs per arm; actual framework; immutable actor-end;
   closed HAR/trace; pinned official evaluator, unchanged answer; owned cleanup.
   This probe produces acceptance evidence without turning the bulk gate green.
   Its AI-written navigation script is diagnostic, not independently human-blinded.
4. Complete each candidate's authentication policy, full dependency closure and
   frozen Traditional adaptation. WAV's absence of a `require_login` field is
   **not proof that account/order/address tasks require no login**. Do not run
   those as anonymous tasks and attribute the resulting failures to agent ability.
5. Complete independently reviewed full-state inventory/isolation and per-profile
   live evaluation controls. Freeze the shared budget and exact model/framework
   bindings. Only then dispatch the remaining official task batch.

No unsupported official task is replaced by a local synthetic task. No locator
is auto-snapped for CUA, no gold answer enters prompts, no provider fallback and
no silent retry that overwrites failures. Preserve deployment/adaptation failure,
setup failure, provider failure, actuator failure, task outcome and evaluator
error separately. A native task score of zero is valid evidence when the actual
execution and evaluation chain is sound; it is not a reason to drop the task.

## Bounded official acceptance probe

Run from repository root after installing the locked framework environments:

```bash
third_party/frameworks/h-agentlab/bin/python code/experiment/wav_official_acceptance_probe.py \
  --framework agentlab-browsergym --mode visual \
  --manifest /absolute/private/owned-fixture-manifest.json \
  --manifest-sha256 ACTUAL_SHA256 \
  --peer-proof /absolute/private/measured-peer-report.json \
  --peer-proof-sha256 ACTUAL_SHA256 \
  --bindings /absolute/private/official-wav-task-bindings.json \
  --output /absolute/private/new-acceptance-directory --port-base 18170 --live
```

Placeholders deliberately do not run. Each output directory and port pair must
be new/unused. Use `--mode hybrid` for AgentLab Hybrid. Browser Use requires its
own Python executable and `--framework browser-use-restricted --mode hybrid`.
Traditional uses `--framework playwright --mode traditional`, with no paid calls.
The probe is intentionally restricted to tasks 260, 261, 274 and 324, not a
hidden 100-task bypass. Tasks 261 and 324 additionally require the pinned
diagnostic AI-authoring policy; this does not make them independently
human-blinded. Task 274 uses the published search intent and its separately
prewritten combobox/Enter script; none of these scripts reads the native
evaluator. A framework/interpreter package preflight now rejects a Browser Use
run launched from AgentLab's Python environment before any fixture reset.
Live execution provisions and eventually removes only its exact owned container
and network. It never adopts the old wildcard-bound primary container.

Freeze before dispatch: 180-second actor / 24 actions / 2048 output-token probe
settings are declared in each configuration; they remain proposed for the full
100-task campaign. Setup/evaluation/finalization are separate from actor time.
Model alias use is disclosed, not misrepresented as a fixed model snapshot.
Costs in the local ledger are reservations until provider billing is observed.

## ATA / VWA scope

VWA provisioning is deferred for this local batch by user direction; no VWA task
is counted as run. ATA source labels and input adapters are available, but the
official reset code references `Smartesting/vtaas-benchmark`. On 2026-09-22 a
read-only Git query returned `Repository not found`; all three documented public
sites failed connection from this machine. This does not prove global outage or
that the repository is private. No remote workflow, reset or write was attempted.

ATA needs a reachable, authorized original fixture with baseline databases/assets
and reset instructions. Correction after re-reading the original paper: its FAIL
cases were constructed by changing test instructions to demand unimplemented
features, NOT by requiring a separately injected defective application version.
See [the paper, Sections 4.2, 4.3 and 8](https://arxiv.org/html/2504.01495v1).
The authors refer to the original WebArena/VWA application images, so the
unavailable hosted reset repository is not proof that local deployment is
impossible. Original Postmill/Shopping image availability, storage and state
parity must be checked before declaring that path blocked. Generic WAV-Verified
Shopping is not automatically equivalent to the original ATA fixture. Keep the
113 source cases (62 PASS / 51 FAIL) separate from live executions; do not report
label-parser tests as benchmark task completion.

## Engineering issues found in actual task 260

- A probe supervisor heartbeat was missing during synchronous browser capture
  and finalization. Actor/model heartbeats shortened the lease to 30 seconds;
  a slow close could then fail ledger sealing. The new independent heartbeat
  retains fencing, and the envelope is persisted before ledger finalization.
- Screenshots previously inherited the five-second action timeout. New probes
  explicitly declare a 30-second observation cap, still clipped by the actor
  deadline. The same cap applies to Traditional replay. Private operation-level
  error logs preserve the reason; no error detail or evaluator evidence is fed
  back into model prompts.
- CSS-pixel visual clicks in the first probe resembled normalized Qwen axes.
  A separately named `--coordinate-space qwen-0-999` probe tests that hypothesis.
  Never reinterpret the old failed coordinates or pool the two configurations.
- Four-profile acceptance is sequential because concurrent cold starts put
  substantial load on the emulated x86 VM. This is not a performance-speedup
  claim and does not make host timings representative of sponsor hardware.
- A later controlled acquisition policy allows at most three complete
  screenshot/projection recaptures. Each rejected pair is logged. Pixel equality
  remains exact; no tolerance, stale controls or goal-aware selection is added.
- Playwright's first click also hit its five-second timeout after resolving an
  actionable target. Subsequent configurations declare a common 30-second
  action cap (still inside the 180-second task budget), rather than secretly
  relaxing only one arm's timing.
- Browser Use's unrelated telemetry and cloud sync are disabled in the actual
  driver before import, not only in offline test environment variables.

These changing acceptance configurations must NOT be pooled as a comparative
success rate. Before the 100-task campaign, freeze the same coordinate convention
for all Qwen agent profiles, plus timeouts, observation acquisition and resource
policy. Keep earlier alternatives as explicitly versioned diagnostic evidence.

## Traditional authoring handoff

`prepare_wav100_authoring.py` verifies all 100 public input/setup hashes and
exports only public instructions, start URLs and the public output contract.
It never reads evaluator files or agent outcomes. Each entry starts PENDING;
authoring/review time is null rather than invented zero. Share this isolated
folder with baseline authors, not private evaluator or run directories.
The design's human-authored blinded baseline remains a separate requirement;
the two AI-written diagnostic scripts do not fulfill it. Authentication policy
also needs an explicit per-task review before account-dependent tasks run.

```bash
python code/experiment/prepare_wav100_authoring.py \
  --plan code/config/wav-qwen38max-100-development.v1.json \
  --bindings /absolute/private/official-wav-task-bindings.json \
  --output /absolute/private/new-public-authoring-pack

python code/experiment/summarize_wav100_campaign.py \
  --artifacts code/artifacts/local-runtime \
  --output /absolute/private/new-progress-report.json
```

The summary counts distinct official IDs separately for each profile; retries
and setup-only attempts cannot fill the 100-task target. It retains original
reports and exports only hashed response metadata, token counts and latency.
Unknown billed cost stays null. A native score alone cannot qualify a run:
actor completion, budget compliance, unchanged source and intact replay are
reported separately. The current reader covers the bounded acceptance-probe
format, not unverified cloud data or a future bulk ledger format.
