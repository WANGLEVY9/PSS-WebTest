# Session, authentication and isolation handoff

Updated 2026-09-22. Engineering implementation and deployment instructions;
**not** a claim of completed VWA/ATA live acceptance. Read with
`SPONSOR-DEPLOYMENT.md`, `ACCEPTANCE-RUNBOOK.md`,
`LIFECYCLE-AND-NATIVE-EVALUATION.md` and `VWA-FIXTURE-DEPLOYMENT.md`.
All commands below run from `code/`. Replace uppercase absolute-path variables
with operator-reviewed values. Examples are templates, not collected evidence.

## 1. Implemented entry points and remaining host work

| Component | Implemented and testable | Still required on the sponsor host |
|---|---|---|
| Traditional | `traditional_actor.py`, monotonic actor timing, per-operation frames, hash-chained journal, sealed HAR/trace | Outcome-blind adaptation of each official task; real task runs |
| Owned session | `benchmark_session_wrapper.py`, current running lease, reset-event binding, frozen input/config/source pins | Pin actual routes, reset/evaluator commands and API bindings |
| Authentication | `session_auth.py`, private per-reset proof and storage validation | Site-specific login and authenticated health probes AFTER each reset |
| Isolation | `isolation_evidence.py`, full declared component exports, ten-stage bidirectional checks | Reviewed full-state inventory, faithful exporters, two owned live fixture copies, actual mutation/reset |
| VWA | Private Classifieds provisioning; reset proof validation; actual native live-page evaluation | Native x86 deployment of complete task site closure, full-state reset backend, optional native fuzzy/VQA judge |
| ATA | Original archive/CSV binding, independent published-label/step scoring | Faithful original fixtures/defects, owned reset backend, live-state label parity |

The local Mac cannot substitute for sponsor Linux x86 verification. Do not
download the oversized VWA image into an inadequately sized Docker VM. Source
tests and loopback Chromium controls remain separate from real benchmark runs.

## 2. Traditional script contract

Scripts are pinned Python files exposing `run(session, public_task) -> str`.
They do not receive a raw Playwright Page, reset receipt, auth state, gold label,
evaluation configuration, other-arm output or a model connection. A minimal
**synthetic API example**, not an official task implementation:

```python
def run(session, public_task):
    session.get_by_label('Title').fill('SYNTHETIC CONTROL')
    session.get_by_role('button', name='Save', exact=True).click()
    return session.locator('h1').inner_text()
```

Supported locator construction: `get_by_role`, `get_by_label`, `locator`,
locator `.nth()` and nested `.locator()`. Supported operations: `click`,
`dblclick`, `fill`, `press`, `check`, `uncheck`, `select_option`, `inner_text`,
`text_content`, `all_text_contents`, `count`, `is_visible`, `input_value`,
`get_attribute`, `is_checked`, `upload('task-image-N')`. `focus_tab(N)` uses a
known tab ordinal; a popup updates the active page. Upload accepts only pinned
public task-image bytes, never an arbitrary filesystem path.

Every mutation attempt and final `done` consume one action. Locator reads are
recorded separately as `script_reads` and consume wall time, not mutation
actions. This is a prospective **action accounting definition**, not a claim
that a locator fill is physically identical to one visual keystroke. Report
action counts by grammar; use elapsed time and costs separately. Freeze this
definition across matched profiles before running comparisons.

The clock includes script compilation/execution, source snapshots, locator
resolution, screenshots, journal work and final output. Setup, independent
evaluation and trace/HAR finalization use the common separate phases. Each
operation checks the current lease and deadline. Arbitrary Python computation
cannot be preempted by the façade: the worker's process-group timeout remains
the hard stop and produces **unresolved lifecycle-envelope-timeout**, not an
invented capability timeout. Locator wait errors remain separately recorded
execution errors for failure review; do not silently turn them into FAIL gold.

This façade is **not an adversarial Python sandbox**. Scripts are reviewed,
trusted, hash-pinned inputs. Reject imports/accesses that read private files,
use `_` internals, open network/API clients, run raw JavaScript/evaluate, or
consult outcome data. Do not claim OS-level information isolation from Python
attribute naming. Unsupported operations require a separately reviewed adapter
extension and tests; they must not silently fall back to raw Page access.

Old `benchmark-script.mjs` scripts are historical diagnostics. They are not
automatically relabeled as migrated. Port each admitted task under the blinded
adaptation protocol; retain adaptation failures in the deployment denominator.
Diagnostic wrapper bindings require a pinned `traditional_adaptation_ref`:

```json
{
  "schema": "pss-traditional-adaptation-v1",
  "task_key": "OFFICIAL_FROZEN_TASK_KEY",
  "script_ref": {"file": "/ABSOLUTE/reviewed_task.py", "sha256": "REVIEWED_HASH"},
  "status": "frozen",
  "reviewer": "ACTUAL_REVIEWER_ID",
  "other_arm_outcomes_visible": false,
  "evaluator_internals_visible": false
}
```

This is a signed-off process record, not an automatically inferred assurance.
Archive authoring time, inputs provided, author/reviewer identities and source
review separately. The `actor_source_refs` binding must pin all names in
`traditional_actor.SOURCES`; the trajectory snapshots both those modules and
the task script. Editing either requires a new binding, not an old receipt.

## 3. Worker → wrapper → actor → evaluator

Set runtime binding `actor_protocol` to `owned-session-v1`, framework to the
selected real framework, and mode to `visual`, `hybrid`, or `traditional`.
Traditional requires `framework=playwright`, `model_binding=null`; Browser Use
is restricted hybrid. All profiles use `actor-phase-monotonic-v1`, positive
matched budgets/phase limits, SDK retries zero, and source-pinned commands.

Create a private wrapper manifest (new file, immutable after hashing):

```json
{
  "schema": "pss-owned-session-wrapper-v1",
  "artifact_root": "/ABSOLUTE/PRIVATE/actors",
  "routes": {"__SHOPPING__": "http://SHOPPING_OWNED_HOST:PORT"},
  "viewport": [1280, 720],
  "locale": "en-US",
  "timezone_id": "UTC",
  "node": "/ABSOLUTE/node",
  "supervisor_source_refs": {"EACH_NAME_IN_SUPERVISOR_SOURCES": {"file": "/ABSOLUTE/code/local-lab/NAME", "sha256": "ACTUAL_HASH"}}
}
```

`benchmark_session_wrapper.SUPERVISOR_SOURCES` is the authoritative exact list,
not a wildcard. VWA also requires `native_evaluator_ref` pointing to the pinned
`pss-vwa-native-evaluator-v1` manifest. It must use the same actual deployed
site routes and source/dataset pins as setup. WAV/ATA evaluate after closure via
their separate worker commands. Keep gold and evaluator files private.

Actor command argv is an array, with no shell interpolation:

```text
/ABSOLUTE/framework-python /ABSOLUTE/code/local-lab/benchmark_session_wrapper.py
  --manifest /ABSOLUTE/PRIVATE/wrapper.json --manifest-sha256 ACTUAL_HASH
```

Set its `source` to that wrapper file and `sha256` to its current bytes. The
timeout must be at least task timeout plus all four lifecycle allowances.
Hash the complete runtime binding into the opportunity only after all command
and manifest hashes are final. Pin the setup and outcome-free task projection
with the existing `task_input_binding` / `setup_binding_sha256` contracts.
Never mutate an already enqueued opportunity to change its model or script.

Start through `runtime_worker.py`, **not** by inventing wrapper stdin:

```bash
python local-lab/runtime_worker.py enqueue --database /ABSOLUTE/PRIVATE/ledger.sqlite --input /ABSOLUTE/PRIVATE/opportunities.jsonl
python local-lab/runtime_worker.py work --database /ABSOLUTE/PRIVATE/ledger.sqlite --input /ABSOLUTE/PRIVATE/runtime-binding.json
python local-lab/runtime_worker.py status --database /ABSOLUTE/PRIVATE/ledger.sqlite
```

The worker freezes configuration, starts the lease before reset, records a
hash of the reset receipt in SQLite, then sends a supervisor envelope. The
wrapper checks the existing running row, lease, binding hash, reset event and
exact public projection. Only the public projection enters the actor. Setup
metadata never becomes a progress signal. Four commands still need actual
deployment-specific bindings: reset, actor, evaluate and cleanup. The wrapper
does not fabricate those missing adapters. SQLite must be local, not NFS.

## 4. Per-reset authentication protocol

The reset adapter must return the usual execution fields **including
`lease_token`**, full closure reset evidence and optional `authentication_ref`.
The latter points to a private `pss-reset-auth-v1` proof, NOT directly to an old
Playwright storage-state file. Required fields:

- `opportunity_id`, `environment_id`, `configuration_sha256`, `lease_token`;
- `scope`, `data_kind`, `baseline_sha256`, exact `setup_ref` and
  `reset_evidence_ref` from the current opportunity/reset;
- finite `created_at_unix`, `expires_at_unix`, covering this run;
- `authenticated_sites`, `authenticated_health_ref`, `storage_state_ref`.

Storage and health files must be absolute, regular, non-symlink, mode `0600`,
hash-pinned files. Health evidence contains the same four execution identities,
the exact reset ref, `authenticated=true`, and `sites` matching the declared
authenticated sites. The storage JSON contains `cookies` and `origins` only.
Cookie domains must belong to deployed route hosts; localStorage origins must
match scheme/host/port exactly. Expired cookies, empty storage, wrong leases,
unreadable files and drifted bytes are rejected.

Operational order: restore backend → login with the official designated account
in a temporary setup context → save storage → verify expected logged-in identity
and protected route with site-specific health probe → close setup context →
freeze proof → return reset receipt → launch fresh actor context. Do not reuse
the previous arm's context/session simply because its cookies still work.
The wrapper validates evidence provenance, not server-side credential validity;
the live health probe remains mandatory. For multi-site tasks, prove all
required accounts. Avoid same-host cookie collisions across different ports;
use the upstream route/hostname conventions and test each protected origin.

Tokens, cookies, HARs, traces and provider responses stay private. Publish only
reviewed summaries and hashes. Never add raw authentication evidence to Git.

## 5. Full cross-instance isolation procedure

Provision owned A and B copies of the *complete* official dependency closure.
Shared immutable image layers are fine; shared mutable databases, volumes,
object prefixes, queues or cache namespaces are not. Inventory every such
component from compose/inspect, database schemas, mount configuration and
upstream reset code. A fresh browser context proves none of this by itself.

Create `pss-mutable-state-inventory-v1` with:

- `components`: nonempty unique `{id, kind}` list; kind is `database`,
  `filesystem`, `object-store`, `cache`, or `queue`;
- `instances`: `A` and `B`, each mapping every component ID to its concrete
  mutable resource identity; their resource sets must be disjoint;
- pinned `topology_ref`, `exporter_source_ref`, `quiescence_protocol_ref`;
- `coverage_review_ref`: independent reviewer record with exact ordered
  `component_ids`, `reviewer`, `closure_verified=true`, `unresolved_components=[]`.

Export the entire logical application database, not two selected rows. Include
schemas, sequences/autoincrement policy, triggers and routines where used.
For MySQL use a consistent export with deterministic ordering and no dump-date
comments (credentials from a private defaults file, not CLI password text).
Record exporter version/argv/schema list and exit status. A consistent DB
transaction does not make simultaneous filesystem exports consistent: stop or
quiesce ALL background writers under the frozen protocol before capture.

For uploaded/task files, export a sorted manifest covering every relative path,
file byte digest, link target and required ownership/mode metadata. Do not follow
symlinks outside the owned tree; record them. Include database external storage,
object stores, queues/cache and sessions when they can affect a task. Never
silently exclude runtime drift to make hashes equal. If benign nondeterminism
requires normalization, predeclare and review the deterministic exporter before
comparing outcomes; pin the code and retain raw evidence.

Capture ten snapshots in this exact same-host order:

```text
A0 → B0 → mutate A → Am → B_after_Am
   → reset A → Ar → B_after_Ar
   → mutate B → Bm → A_after_Bm
   → reset B → Br → A_after_Br
```

Each mutation must visibly change every declared component; use reversible,
owned control records/files/queue keys, never public sites or another team's
fixtures. Each reset is the actual per-arm reset command. Preserve errors and
quarantine uncertain resources. Do not delete an original failed report.

Each snapshot JSON uses `pss-isolation-state-v1` and records `inventory_ref`,
`instance`, `stage`, exact `resource_ids`, `capture_started_ns`,
`capture_ended_ns`, `quiescent=true`, `unresolved_components=[]`, and `exports`.
Every export is `{file:absolute_private_path, sha256, bytes}`. The verifier
streams raw bytes, rejects empty exports, checks full component coverage and
compares BOTH baseline restorations plus all four peer observations. Times
must be ordered within one host/boot; never compare cross-host monotonic clocks.

Package the refs as `pss-cross-instance-isolation-v1`, `inventory_ref` and
`snapshots:{A0:ref,...,A_after_Br:ref}`. For acceptance, include actual `host_id`,
`campaign_id`, `benchmark`, `profile`, `scope=diagnostic`, `data_kind=MEASURED`.
The per-profile fixture receipt requires `cross_instance_isolation_ref`:

```bash
python local-lab/isolation_evidence.py /ABSOLUTE/PRIVATE/isolation-package.json
python local-lab/benchmark_acceptance.py --package /ABSOLUTE/PRIVATE/fixture-package.json --output /ABSOLUTE/PRIVATE/fixture-audit-001.json
```

The first command certifies byte-level consistency **within the reviewed
inventory**, not the truthfulness of the collector or an omitted-service-free
topology. Independent inventory/exporter review is indispensable. Container ID
equality or manually typed equal digest strings no longer suffice for the
fixture gate. Acceptance still needs two per-arm reset cycles, fresh contexts,
native evaluator controls, boundary/replay/budget/provider evidence and review.

## 6. VWA deployment and real per-profile acceptance

1. Provision native Linux x86_64 with measured Docker storage reserve. Install
   pinned official VWA source and its separate Python/evaluator environment;
   do not transplant the Mac wheel environment. Run doctor and offline tests.
2. Deploy Classifieds through `VWA-FIXTURE-DEPLOYMENT.md`. Deploy pinned official
   Shopping/Reddit and any task-required immutable sites separately. A
   Classifieds-only compose is not the complete VWA benchmark.
3. Implement owned reset/cleanup adapters for all mutable sites. A Classifieds
   reset HTTP 200 is only transport evidence. Restore DB AND upload/object
   state; independently recapture baseline digest and health. Shopping/Reddit
   need actual snapshot/restore support, not `page.reload()`.
4. Emit `vwa_reset_contract.py` measurements for every official site in the
   task closure, plus the fresh authentication proof above. Missing closure
   means blocked task, not a lower native score.
5. Run the two-instance content proof. Then run two per-profile mutate/reset
   cycles for AgentLab visual, AgentLab hybrid, restricted Browser Use hybrid,
   and Playwright. Do not copy another profile's green receipt.
6. Execute native positive, negative and malformed controls against the deployed
   pages. The VWA supervisor must evaluate the actual final active Page after
   actor-end and before close; CLI consumes the sealed receipt after close.
7. Freeze the development selection and run the 20 official tasks/profile plus
   five repeated tasks. Fuzzy/VQA tasks remain blocked until their separate
   official judge is explicitly configured and audited. Do not filter them out
   based on which agent succeeds; deterministic-only is a declared limitation.

## 7. ATA deployment and real per-profile acceptance

The published archive's `pinata/evaluation.py:27–100` calls GitHub workflows in
`Smartesting/vtaas-benchmark` to reset Postmill, Shopping and Classifieds. Do
**not** run that orchestration as a sponsor restore backend or dispatch work to
the authors' infrastructure. The artifact README's public URLs are historical
replication context, not permission or proof of current accessible fixtures.

1. Obtain and pin the original fixture/defect images, DB seeds and reset
   semantics. Preserve the original archive and all six CSVs. If an original
   image/defect seed cannot be obtained, document it as an external gate; a clean
   current VWA/WAV image is not an equivalent ATA fault-bearing environment.
2. Deploy owned equivalents for all task-required sites, loopback/private
   ingress, separate A/B mutable namespaces, no author-owned workflow dispatch.
3. Implement owned restore/cleanup adapters and the same authentication/full
   state inventory checks. Do not infer reset success from a homepage response.
4. Establish **live label parity independently of the actor**: execute reviewed
   positive/negative control procedures for the relevant original task/defect;
   preserve state evidence, screenshots/network/DB proof and original CSV row
   refs. A published FAIL label alone does not prove the defect is deployed.
5. Keep `ata_native_evaluate.py` as independent published-reference scoring:
   exact PASS/FAIL/abstention semantics and original failure-step annotations,
   113 rows (62 PASS/51 FAIL), not a generic binary task-success score.
6. A separate reviewed parity receipt must satisfy
   `acceptance_coverage.py`'s `pss-ata-live-label-parity-v1` contract. The current
   reference adapter deliberately returns `live_fixture_label_parity_verified=false`.
   Do not flip that constant. Bind a measured parity artifact through a reviewed
   evaluator adapter/composer and test its negative cases before admission.
7. Repeat real reset/isolation/evaluator/replay acceptance for all four profiles,
   then the frozen development tasks. Retain genuine task failures; unresolved
   fixture parity is an engineering/external failure, not agent incapability.

## 8. Reproduction and troubleshooting

```bash
PYTHONPATH=local-lab PYTHONDONTWRITEBYTECODE=1 /ABSOLUTE/agentlab-python -m unittest test_runtime_actor_lifecycle test_runtime_session_wrapper test_runtime_session_auth test_runtime_isolation_evidence test_runtime_acceptance -v
node local-lab/sponsor-portable-verify.mjs --python /ABSOLUTE/python --framework-profile /ABSOLUTE/PRIVATE/deployment.json --output /ABSOLUTE/PRIVATE/offline-verification-NEW
```

| Symptom | Required response |
|---|---|
| Wrapper binding/source drift | Rebuild candidate pins and new schedule; never alter old opportunity |
| Reset not attested / stale lease | Inspect current SQLite owner and reset event; quarantine, no blind retry |
| Auth expired/origin mismatch | Fresh reset/login/health proof; no cookie-domain widening |
| Script unsupported method | Reviewed façade extension + regression; no raw Page bypass |
| Peer export differs | Inspect DB/files/cache/queue and background writers; block isolation |
| Missing ATA parity | Obtain faithful original state; keep evaluator unresolved |
| VWA judge unavailable | Preserve blocked task and provision/audit native judge separately |
| Native score 0, coherent complete trace | Retain as possible genuine capability evidence; review failure attribution |
| Actor process killed before seal | Engineering/external unresolved; keep partial files and quarantine |

Deliver private run envelopes, raw replay artifacts and ledger backups to the
research team through controlled storage, not public Git. Public summaries must
state test type, source hash, counts, skips, errors and remaining gates. No
`confirmatory_authorized=true` is emitted by these tools. Successful deployment
is not permission to alter task filtering, information boundaries or denominators.
