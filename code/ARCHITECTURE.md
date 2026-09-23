# Code architecture

The codebase implements a benchmark-independent study pipeline with benchmark-specific task adapters and native evaluators. Its experiment matrix covers WAV, VWA and ATA using AgentLab visual (v), AgentLab hybrid (h), restricted Browser Use hybrid (u), and a shared Playwright script baseline (s). The experiment map defines the task samples, rounds, input boundaries and procedures.

## Evidence flow

```text
Study design and task selection
    -> public actor input and private fixture/evaluator setup
    -> framework adapter with validated model requests
    -> journaled attempt and trajectory
    -> benchmark-native evaluation
    -> validated, provenance-preserving record
    -> research-question analysis and summary
```

| Layer | Maintained implementation | Responsibility |
| --- | --- | --- |
| Study contract | `config/active-study-design.json`, `config/study-design-contract.v2.1.json` | Samples, model identities, execution cells, rounds and planned denominator |
| Campaign inputs | `config/current-campaign.json`, `config/frameworks/`, private ignored bindings | Task schedule, framework profile and environment-specific settings |
| Workflow | `analysis/study-workflow.mjs`, `analysis/study-pipeline.mjs` | Task identities, schedule construction, input binding and record import |
| Runtime | `experiment/runtime_worker.py`, `experiment/runtime_store.py`, `experiment/runtime_inputs.py` | Isolated execution, recoverable ledger, actor/evaluator input separation |
| Framework adapters | `experiment/framework_agentlab.py`, `experiment/framework_browser_use.py`, `experiment/native_framework_driver.py` | Constrained observations, model decisions and validated actions |
| Benchmark evaluation | WAV lifecycle modules, VWA evaluator integration, ATA reference comparison | Benchmark-native outcome and coverage measurement |
| Analysis | `analysis/study-analysis.mjs`, `analysis/analysis-export.mjs` | RQ1–RQ4 estimands, missingness, summaries and export |
| Inspection | `console/` | Local display of execution and analysis records |
| Verification | `tests/experiment/`, `experiment/test_runtime*.py`, `tools/*.test.mjs` | Offline checks of interfaces, formulas and runtime invariants |

## Information and measurement boundaries

Actor observations contain only the inputs assigned to the execution cell. Fixture setup and evaluator references remain private; evaluator-only data never becomes an agent observation. The s cell executes one reviewed script per benchmark/task and shares it across model comparisons. BrowserGym supplies environment and action components to AgentLab; it is not an additional experimental arm.

Each execution binds the task, model identity, framework, prompt, budget, environment, reset state and evaluator version. Attempts and trajectories are journaled before native evaluation. A task outcome, operational correctness, evaluator coverage and missingness remain separate fields in the analysis record.

For module-level run commands and benchmark procedures, see the [experiment map](../docs/EXPERIMENTS.md). Keep credentials, private fixtures and execution outputs in ignored local storage; version study specifications, source pins, schemas and analysis code.
