# Benchmark reference audit and task/metric expansion (2026-08-23)

## Scope and evidence rule

This audit uses official papers, project repositories, or benchmark pages. Public benchmark scale claims are retained as source metadata, but no external task instance is copied into the PSS-WebTest confirmatory sample. Every imported idea must pass our own license, reset, independent-oracle, fault/evolution, and three-arm admission gates.

## What each benchmark contributes

| Reference | Primary contribution to this project | What we do not claim |
|---|---|---|
| WebArena (2023) | realistic self-hosted multi-step workflows and postcondition evaluators | not a three-arm software-testing comparison |
| BrowserGym/AgentLab (2024) | common observation/action interface, benchmark adapters, provenance and reproducibility conventions | not a fault/evolution or maintenance study |
| VisualWebArena (2024) | visually grounded task families and multimodal task design | visual-agent success is not test validity |
| WorkArena++ (2024) | compositionality levels and difficulty stratification | requires a separate enterprise-instance/license audit |
| Online-Mind2Web (2025) | live-web task diversity and explicit task maintenance/update process | live websites are not deterministic local SUTs |
| WebBench (2025) | navigation/form-filling categories and operational benchmark reporting | live-site oracle/reset behavior is not yet verified for our use |
| WebTestBench (2026) | directly relevant end-to-end web-testing benchmark framing | high-priority collision/extension audit remains required |
| WebTestPilot (2026) | bug-injected web-app testing and natural-language testing intent | our screenshot-only arm and its symbolized GUI observation are different contracts |

The machine-readable evidence inventory is [benchmark-reference-matrix.v0.1.json](/Users/laurantwang/PSS-WebTest/code/config/benchmark-reference-matrix.v0.1.json).

## Task-library expansion

The new [task-template-library.v0.1.json](/Users/laurantwang/PSS-WebTest/code/config/task-template-library.v0.1.json) contains eight reusable blueprints:

- navigation and target identity;
- search/filter with negative controls;
- multi-step form persistence;
- cross-page create and revisit;
- role/permission workflows;
- delayed-save and idempotent retry;
- visual-layout targeting;
- repair after locator/UI breakage.

These are design templates, not admitted tasks. Each template declares an oracle plan, fault slots, evolution slots, and benchmark inspiration. Instantiating one for BookStack, Indico, Juice Shop, or a future SUT requires a local fixture, deterministic reset, independent oracle, and a clean three-arm pilot.

## Metric-library expansion

The [metric-dictionary.v0.1.json](/Users/laurantwang/PSS-WebTest/code/config/metric-dictionary.v0.1.json) now separates five measurement families:

1. effectiveness: valid completion and joint end-to-end correctness;
2. oracle quality: verdict correctness, false positives, false negatives;
3. maintenance: repair success, repair time, artifact edit size;
4. reliability/efficiency: repetition stability, wall time, actions, retries, token/cost;
5. diagnostics: failure-category and independent-oracle latency distributions.

The primary unit is the matched task-condition cell. Macro task averages are primary for cross-task comparability; micro averages are supplementary. Infrastructure, provider, evaluator, and task-defect failures remain visible rather than being silently removed.

## Recommended expansion order

1. Admit one additional BookStack blueprint in clean stable condition.
2. Add one search/form blueprint to Indico and one persistence/checkout-like blueprint to Juice Shop only after their clean agent gates pass.
3. Add one fault and one evolution instantiation per admitted workflow.
4. Add a second visual model/provider without changing task, oracle, budget, or run-record schema.
5. Add locator robustness and Selenium/state-model baselines as explicitly labelled exploratory strata.
6. Estimate pilot variance and arm correlation, freeze repetition/power, preregister, then collect confirmatory data.

No new candidate workflow or benchmark reference changes the current Phase 2 admission state. The current Qwen pure-visual BookStack gate remains open/failing, so these assets expand the design space but do not authorize broader collection yet.
