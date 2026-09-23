# Input and output contracts

[Technical index](README.md) · [Runtime](RUNTIME.md)

There are four different input planes. Combining them into a single agent prompt
would leak references, credentials or environment control information.

| Plane | Required content | Allowed consumer |
|---|---|---|
| Study/schedule | Protocol, scope, selected official IDs, application namespace, source hash, configuration, round and preparation availability | Scheduler, importer, analysis |
| Actor | Unchanged public intent, public task images; ATA public source steps | Measured executor only |
| Setup | Ordered start pages, site closure, route bindings, reset identity and authentication references | Trusted session/lifecycle wrapper |
| Evaluation | Original native task configuration, expected answer/verdict and source evidence | Independent evaluator after actor termination |

## Files and binding

The current [planner](../../code/analysis/study-pipeline.mjs) and
[workflow](../../code/analysis/study-workflow.mjs) produce a schedule and
`schedule-freeze.json`. [bind_runtime_plan.py](../../code/experiment/bind_runtime_plan.py)
verifies the freeze digest, exact plan bytes, opportunity identity, task/source
correspondence, input hash and evaluator mapping before producing private JSONL.
The `task-bound-opportunity-v1` identity includes schedule hash, task-manifest
hash, executor-binding hash, task key, configuration ID and round. The task
manifest freezes source/input/evaluator bytes and evaluator-reference digest;
when setup exists, `setup_ref_sha256` freezes it before scheduling. Official
projection and full schedule-freeze checks remain required alongside byte binding.
Legacy identities require explicit reconciliation; do not relabel or re-enqueue them.

VWA IDs require a site namespace, such as `reddit:33`; a bare numeric ID is not
globally unique. WAV template identity is retained for macro averaging. ATA
reference labels belong in the scheduler/evaluator manifest, never the actor
envelope. The expected class is not the actor's verdict.

The public file schema is `pss-official-task-input-v1`, validated by
[runtime_inputs.py](../../code/experiment/runtime_inputs.py):

```json
{
  "schema": "pss-official-task-input-v1",
  "benchmark": "vwa",
  "intent": "SYNTHETIC EXAMPLE: public task instruction only",
  "task_images": []
}
```

This is a shape illustration, not an official task or runnable binding. An image
entry contains a private artifact `file`, SHA-256 and MIME type; the delivered
actor receives image bytes/data URLs without file paths. PNG/JPEG/WebP/GIF are
identified by content. VWA GIF model views use the native initial-frame-to-PNG
conversion, with original bytes retained for upload and both hashes recorded.
ATA additionally requires source `steps` with `step`, `action`, `expectedResult`;
expectedResult is the public assertion instruction, not a hidden PASS/FAIL label.
Source step labels are preserved rather than renumbered after filtering.

## Observation and action boundary

[framework_boundary.py](../../code/experiment/framework_boundary.py) creates the
model-facing projection. Hybrid control entries contain observation-local
`target_id`, role, accessible name, visible value/state and clipped bounding box.
Raw HTML, selectors, stable application IDs, hidden/offscreen fields and gold
are rejected. Geometry/schema validation alone does not prove visibility or
occlusion; the live producer must establish those properties.

Actions are decoded by [framework_actions.py](../../code/experiment/framework_actions.py)
and executed by [journaled_browser.py](../../code/experiment/journaled_browser.py).
One decision produces one accepted action. Uploads name pinned public assets,
not filesystem paths. Tab operations use creation-order ordinals, not hidden
URLs/titles. CSS pixels and declared Qwen 0–999 coordinates are distinct bound
protocols; normalized point conversion never changes scroll-distance units.

## Completion is benchmark-specific

| Benchmark | Executor completion | Authoritative assessment |
|---|---|---|
| WAV | JSON text following native FinalAgentResponse: task_type, status, optional retrieved_data/error_details | Original response plus captured HAR, original task and native evaluator |
| VWA | Native free-text STOP answer | Original router on the final live page, before context close |
| ATA | Exactly `verdict` and `failure_step` | Published reference comparison; live fixture/label parity remains required |

ATA output shape: `{"verdict":"FAIL","failure_step":2}`. Verdict may be PASS,
FAIL or null; failure_step is a positive source step label or null and must be
null unless verdict is FAIL. No Markdown extraction, case repair, missing-as-FAIL
conversion or gold-guided retry is allowed. See
[benchmark_output_contract.py](../../code/experiment/benchmark_output_contract.py).

## Runtime outputs and null semantics

The current worker emits `runtime_protocol=diagnostic-task-bound-v3`. Every
stage echoes opportunity, environment, configuration, lease token, task-manifest
hash, scope and data kind. Evaluation additionally binds its reference and file
hash. Native lifecycle/timing and public-input restrictions remain in force.
See [runtime_worker.py](../../code/experiment/runtime_worker.py). Standalone older
component receipts are historical controls, not valid v3 worker receipts.

| Output | Meaning |
|---|---|
| `actor_started`, `actor_terminal_status` | Whether measured execution began and why it ended |
| `budget_met`, `protocol_completed` | Resource/termination compliance; native success cannot repair a timeout |
| `lifecycle_completed` | Valid receipt/finalization/cleanup chain, not task success |
| `assessment_status`, `native_score` | Evaluation availability and benchmark task score |
| `verdict`, prediction/step fields | ATA prediction and separately computed correctness/alignment |
| `operational_correctness` | Fixed-workload outcome when justified; unknown stays null |
| Phase timing and request rows | Setup/actor/evaluation/finalization costs, attempts and usage coverage |

Missing score is not 0. Missing usage is not free. No request is not proof of no
preparation cost. A valid native score of 0 is a usable failure outcome; an
evaluator exception is unavailable measurement. Retain scheduled, prepared,
started, scorable, lifecycle-completed and successful counts separately.

## Analysis and public export

`pss-analysis-input-v1` is a separate normalized interface with `data_kind`,
schedule/source references, strata, operational grids, native rows and optional
paired RQ policies. Its exact keys and denominators are documented in
[ANALYSIS-AND-ROUTING.md](../../code/docs/runbooks/ANALYSIS-AND-ROUTING.md).
`formal` scope or `CONFIRMATORY_CANDIDATE` is metadata, never permission to run.
Reject duplicate/out-of-selection identities; preserve absent slots as unresolved.

Screenshots, full responses, prompts, HAR, cookies, evaluator gold and SQLite/WAL
stay private. Publish reviewed summaries with source hashes and explicit missing
evidence. A hash establishes identity, not scientific validity or permission to
publish. See [data availability](../DATA_AVAILABILITY.md).
