# Qwen3.8-Max: 100 official WAV tasks per execution profile

This is a requested **development/diagnostic** campaign, not a replacement of
the manuscript's 19-configuration/12-round design and not confirmatory collection.
The shared set contains 100 different official task IDs, not 100 retries.

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
3. Use `wav_official_acceptance_probe.py` for one bounded official task (260):
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
third_party/frameworks/h-agentlab/bin/python code/local-lab/wav_official_acceptance_probe.py \
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
The probe is intentionally restricted to task 260, not a hidden 100-task bypass.
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
