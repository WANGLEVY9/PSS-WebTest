# Code architecture

The project has one current operator target: the WAV 120-task GPT campaign in `config/current-campaign.json`. Its dispatcher, task IDs and API bindings are still incomplete. `config/active-study-design.json` describes an earlier manuscript analysis contract and is never an implicit fallback for WAV dispatch.

## Evidence flow

```text
Campaign plan and task IDs
    -> restricted actor input and runtime binding
    -> framework adapter with guarded model requests
    -> immutable attempt receipt and trajectory
    -> separate native evaluator
    -> imported record validation
    -> analysis and public summary
```

| Layer | Maintained implementation | Boundary |
| --- | --- | --- |
| Configuration | `config/current-campaign.json`, `config/frameworks/`, private ignored bindings | Public plan contains no credentials or task outcomes |
| Workflow | `analysis/study-workflow.mjs`, `analysis/study-pipeline.mjs` | Explicit task identities and schedule hashes |
| Runtime | `experiment/runtime_worker.py`, `experiment/runtime_store.py`, `experiment/runtime_inputs.py` | Recoverable ledger, separate actor and evaluator inputs |
| Framework adapters | `experiment/framework_agentlab.py`, `experiment/framework_browser_use.py`, `experiment/native_framework_driver.py` | Observation and action restrictions remain enforced |
| Benchmark evaluation | `experiment/wav_native_evaluate.py` and WAV lifecycle modules | Native reference is evaluator-only |
| Analysis | `analysis/study-analysis.mjs`, `analysis/analysis-export.mjs` | Imported records retain missingness and provenance |
| Inspection | `console/` | Local evidence display does not authorize dispatch |
| Verification | `tests/experiment/`, `experiment/test_runtime*.py`, `tools/*.test.mjs` | Offline fixtures remain separate from measured runs |

The implementation in `experiment/` still contains modules for the historical VWA/ATA manuscript design. They are not operator entry points for the current campaign. The archived local-application architecture, its tests, dated status reports and raw pilot results are in `../temp/` and are excluded from Git. Preserve provenance when moving or comparing any historical record.

For new work, keep exact model IDs, task selection, budgets, source pins and evaluator controls in versioned campaign-specific inputs before measured execution. Do not infer benchmark readiness from source-only tests or a running console.
