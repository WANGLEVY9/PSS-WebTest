# Release acceptance before sponsor handoff

The research team, not the sponsor, owns first end-to-end integration. A release is **not ready for full-study handoff** until real pinned frameworks, official sites, reset and evaluation have passed on the release code/configuration. The sponsor repeats a bounded deployment check before scaling. Do not remove a false execution gate to make a demo green.

## Required stages and stop conditions

| Stage | Work | Pass condition | Resource policy |
|---|---|---|---|
| 0: offline engineering | Clean checkout, dependencies, browser contracts, task binding, concurrency/recovery, real-process synthetic chain, metrics | Every required check passes; no skip called a pass; source unchanged during tests | No provider credentials or model calls |
| 1: environment/native controls | Official site dependency closure; source/image versions; mutate disposable state then reset; native positive and negative evaluator controls, repeated | Correct controls and restored baseline for each application; actual images/attachments verified | No agent model; evaluator model costs, if any, have an explicit cap |
| 2: framework integration | Real AgentLab visual/hybrid, restricted Browser Use hybrid, and script; task projection, action journal, provider ledger and native output | Real framework identity/observations verified, reset per arm, budget semantics correct, all requests accounted, normalized export accepted | One configuration/site at a time; stop immediately on infrastructure/contract/accounting failure |
| 3: selected model/configuration coverage | Every intended model/provider API binding in each applicable framework/input mode | Returned model, request format, image handling, limits and ledger agree with frozen configuration | Small declared cases per binding; no silent fallback |
| 4: fault and restart acceptance | Provider throttle, known timeout, ambiguous transport, process kill, cleanup failure, disk/queue recovery; concurrent workers | No duplicated experiment, old lease fenced, unknown costs retained, no cross-arm state contamination, recoverable evidence | Deterministic injected failures first; no paid stress loop |
| 5: clean-host rehearsal | From frozen source, download/pin fixtures, install locks, run same bounded suite, export results | Another clean Linux host reproduces engineering outcomes without developer absolute paths or private history | Fixed time/request/cost caps, fail fast |
| 6: release | Freeze code, manifest, task projection, adapters, prompts, budgets, prices and successful evidence package | All prior gates complete; official selection and human-script scientific evidence complete; documented approved acquisition entry point | Sponsor reruns bounded deployment check before gradual scale-up |

Stage 2 must cover at least an official read task, a state-changing task and its reset, a VWA task using its actual image attachment, and ATA expected-PASS and expected-FAIL tasks with native step alignment. Repeat each relevant arm to check reset independence. Do not force a model to achieve 100% task success: an agent capability failure can be a correctly collected observation. Infrastructure, identity, boundary, evaluator-control or accounting failures are release failures. Do not retry until the model succeeds.

The exact tasks, numeric action/time/request/cost caps and provider must be fixed before paid execution, using development tasks separate from confirmatory selection. A failed stage blocks subsequent stages. A new model, prompt, input projection, evaluator, reset implementation or executable binding invalidates its prior acceptance evidence. A new machine needs fresh environment/reset evidence.

## Current executable diagnostic chain

From `code/`, prepare a private bundle and executor package. Tasks must include `source_sha256`, `agent_input_sha256`, `evaluation_sha256`, `evaluation_ref_sha256`. Source and evaluator files remain private. Use `runtime_store.digest(executor)` to populate `bindings.configurations[config_id].executor_binding_sha256_by_benchmark[benchmark]` **before** producing the plan. Each executor pins argv/source bytes, actual model, budget, environment and cost policy. The package maps each task to source_file, agent_input_file, agent_input_sha256, evaluation_file and evaluation_ref. For official tasks, evaluation_ref is a pinned file object and the source preparation tools emit its digest. Also freeze setup_ref_sha256 when setup is present, and set package.schedule_freeze_sha256 from the exact generated freeze file. A missing binding is an error, not a guessed default.

```sh
node analysis/study-workflow.mjs plan PRIVATE_BUNDLE.json NEW_PLAN_DIR
python3 experiment/bind_runtime_plan.py --plan NEW_PLAN_DIR/opportunities.jsonl --freeze NEW_PLAN_DIR/schedule-freeze.json --bindings PRIVATE_EXECUTORS.json --output NEW_BOUND.jsonl
python3 experiment/runtime_worker.py enqueue --database NEW_LEDGER.sqlite --input NEW_BOUND.jsonl
python3 experiment/runtime_worker.py work --database NEW_LEDGER.sqlite --input ONE_EXECUTOR.json
python3 experiment/export_runtime.py --database NEW_LEDGER.sqlite --bundle PRIVATE_BUNDLE.json --output NEW_RECORDS.json
node analysis/study-workflow.mjs import NEW_RECORDS.json NEW_ANALYSIS_DIR
```

These are diagnostic commands, not a formal acquisition launcher. `work` executes one eligible opportunity. Do not wrap it in an unbounded loop before the stage's caps and stop conditions are enforced. Large study plans are not canary selections: use a separate diagnostic bundle and explicitly select the bounded opportunities before enqueueing. The framework-specific stage commands still must be implemented and validated on real official tasks; supplying a shell command or framework label is not evidence of that integration.

The exporter retains a consistent ledger snapshot, provenance, native outcomes, actor budget status and known/unknown cost. Missing request rows do not imply zero cost. Quarantined/nonterminal opportunities remain unknown, never silently re-executed. The resulting bundle is checked against its task/campaign identity by the normal study importer. SYNTHETIC_TEST data cannot become measured evidence.

## Evidence delivered with a runnable release

- Exact code and configuration hashes, tested host/architecture and environment/image IDs, official source/input/evaluator hashes and task selection.
- Stage-by-stage commands, exit codes, logs and timestamps; positive/negative controls and repeated reset evidence; actual framework version and observation/action boundary evidence.
- Original opportunities, stage receipts, normalized records, analysis, provider request IDs and cost reconciliation. Failed and unknown cells remain visible.
- A measured small-run throughput/cost estimate and explicit batch ramp-up limits; a stop/resume/recovery runbook tested by fault injection.
- Clean-host rehearsal results and a release status separating engineering readiness, live native integration, scientific admission and sponsor deployment checks.

At present the repository's synthetic tests and byte-binding protections are useful prerequisites. They do not prove that all official benchmark/framework adapters are implemented, that a native Linux release has passed, or that the full 322,164-opportunity acquisition can be handed over. Those claims require the stage evidence above.
