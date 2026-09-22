# WebArena-Verified technical design

[Technical index](../README.md) · [Source mapping](../UPSTREAM_TRACEABILITY.md)

## Native authority

Source: ServiceNow/webarena-verified, commit
`6473f72db5dcefc97b5725b59e734504edc28a21`.
The [fixed README](https://github.com/ServiceNow/webarena-verified/blob/6473f72db5dcefc97b5725b59e734504edc28a21/README.md)
defines the versioned 812-task dataset, response/network-trace evaluation and
site setup. The original WebArena dataset and the 258-task Hard subset are
different selections. PSS plans 600 selected tasks; neither the source inventory
nor the shopping-only local slice establishes that selected population.

## Input and environment closure

Preserve official task ID, intent, template, declared sites and ordered start
URLs. Actor input must be separated from native eval configuration and references.
Use [prepare_navigation_runtime.py](../../../code/local-lab/prepare_navigation_runtime.py)
and the [binding contract](../INPUT_OUTPUT.md); generated IDs cannot replace
source identity. Multi-start tasks retain all declared pages.

The fixture closure can include shopping, shopping_admin, reddit, gitlab,
wikipedia and map. Website/config changes, authentication and captured network
origins must agree. BrowserGym's stock WebArena registration does not establish
WebArena-Verified version or evaluator parity.

## Native output and assessment

The native [FinalAgentResponse type](https://github.com/ServiceNow/webarena-verified/blob/6473f72db5dcefc97b5725b59e734504edc28a21/src/webarena_verified/types/agent_response.py)
governs structured completion. The project publishes the common schema to every
arm without revealing task-specific expected answers. Keep original completion
bytes and complete HAR; native assessment receives both with the original task.
Malformed output is not repaired using gold or silently converted to failure.

```mermaid
sequenceDiagram
    participant W as Worker
    participant F as Owned fixture
    participant A as Executor
    participant E as WAV evaluator
    W->>F: Reset and bind baseline
    W->>A: Public task and trusted session
    A->>F: Journaled browser actions
    A-->>W: Original completion
    W->>W: Close context and seal HAR
    W->>E: Pinned task plus completion and HAR
    E-->>W: Native score and assessment status
```

[wav_native_evaluate.py](../../../code/local-lab/wav_native_evaluate.py) verifies
task/source evidence and calls the original evaluator. Actor timing ends before
trace finalization and native evaluation, but those phases remain bounded and
reported. A late native success cannot override an actor timeout.

## Implemented limits and acceptance

[wav_owned_lifecycle.py](../../../code/local-lab/wav_owned_lifecycle.py) currently
targets owned, mount-free shopping fixtures. It does not implement the whole six
site closure. [benchmark_task_session.py](../../../code/local-lab/benchmark_task_session.py)
binds reset, setup, authentication and start pages. General instance reset
controls and unchanged peer container IDs alone do not prove peer data isolation.

Required acceptance: exact image/source pins; per-arm baseline measurement;
correct login/start-page routing; complete HAR; native positive/negative controls;
valid outputs from all four development profiles; actual unchanged peer state;
crash quarantine; replay/source consistency. Read-only retrieval fixtures do not
cover mutation/navigation tasks. HTTP health is necessary but insufficient.

Report template-macro task success per round and equal-round aggregation using
the declared scheduled rounds. Also report scorable coverage and fixed-workload
operational bounds. Do not report the project’s selected-task estimate as the
full upstream leaderboard score. Cloud installation details are in the
[operator handoff](../../../code/local-lab/cloud-handoff/README.md).

## Separate WAV100 development campaign

[WAV100-QWEN38MAX-PLAN.md](../../../code/docs/runbooks/WAV100-QWEN38MAX-PLAN.md)
records a separate 100-task Shopping-only development set, four profiles and a
bounded task-260 acceptance probe. Its 400 opportunities are a target, not a
completed-run count; it does not replace the 600-task research selection.
Authentication requirements must be checked per task rather than inferred from
an absent `require_login` field. The owned peer probe checks selected tables and
markers; that does not certify Redis, search, queues or every mutable table.
Probe outcomes and coordinate variants remain separate evidence strata.
