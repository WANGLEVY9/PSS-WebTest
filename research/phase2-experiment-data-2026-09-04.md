# Phase 2 experiment data ledger — 2026-09-04

**Generated:** 2026-09-13T02:30:00.050Z  
**Scope:** BookStack feasibility/admission pilot. This ledger does not contain confirmatory estimates.

## Evidence classification

| Class | Inclusion rule | Interpretation |
|---|---|---|
| Current v0.2 admission evidence | phase2-clean-v*, phase2-evolution-v*, and separately tagged paired create-page clean/fault ledgers; registry-resolved records; all three arms; independent oracle; reset digest | Supports only narrow, workflow-and-condition-specific admission subgates |
| Historical / excluded ledger | Any other JSONL artifact | Retained for traceability, diagnosis, or prior pilot context; never pooled into the current table |

## Current v0.2 matched evidence

Strict pass means **completed protocol + reached independent-oracle state + emitted verdict equals ground truth**. It is not merely a final page state or agent self-report.

| Task | Condition | Arm | n | Strict passes | Strict rate | Mean wall time (s) | Mean actions | Mean retries | Reset digest prefix | Configuration | Failure categories |
|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| bookstack-create-page | clean-stable | hybrid | 3 | 3/3 | 100.0% | 13.859 | 8.00 | 0.67 | 6246d6dbf78b | hybrid-pss-native-aliyun-qwen3-vl-flash-v2 | none |
| bookstack-create-page | clean-stable | playwright | 3 | 3/3 | 100.0% | 2.420 | 10.00 | 0.00 | 6246d6dbf78b | scripted-playwright-accessibility-human-v2 | none |
| bookstack-create-page | clean-stable | visual | 3 | 1/3 | 33.3% | 16.420 | 10.67 | 0.00 | 6246d6dbf78b | visual-pss-native-aliyun-qwen3-vl-flash-v2 | agent-step-budget, provider-format |
| bookstack-create-page | functional-fault:persistence-mismatch | hybrid | 3 | 3/3 | 100.0% | 14.400 | 7.67 | 0.67 | 6246d6dbf78b | hybrid-pss-native-aliyun-qwen3-vl-flash-v2 | none |
| bookstack-create-page | functional-fault:persistence-mismatch | playwright | 3 | 3/3 | 100.0% | 2.893 | 10.00 | 0.00 | 6246d6dbf78b | scripted-playwright-accessibility-human-v2 | none |
| bookstack-create-page | functional-fault:persistence-mismatch | visual | 3 | 0/3 | 0.0% | 20.744 | 12.00 | 0.00 | 6246d6dbf78b | visual-pss-native-aliyun-qwen3-vl-flash-v2 | provider-format, grounding-loop |
| bookstack-open-book | clean-stable | hybrid | 3 | 3/3 | 100.0% | 4.254 | 2.00 | 0.00 | 6246d6dbf78b | hybrid-pss-native-aliyun-qwen3-vl-flash-v2 | none |
| bookstack-open-book | clean-stable | playwright | 3 | 3/3 | 100.0% | 1.578 | 6.00 | 0.00 | 6246d6dbf78b | scripted-playwright-accessibility-human-v2 | none |
| bookstack-open-book | clean-stable | visual | 3 | 3/3 | 100.0% | 4.104 | 2.00 | 0.00 | 6246d6dbf78b | visual-pss-native-aliyun-qwen3-vl-flash-v2 | none |
| bookstack-open-book | ui-evolution:bookstack-layout-v1 | hybrid | 3 | 3/3 | 100.0% | 4.202 | 2.00 | 0.00 | 6246d6dbf78b | hybrid-pss-native-aliyun-qwen3-vl-flash-v2 | none |
| bookstack-open-book | ui-evolution:bookstack-layout-v1 | playwright | 3 | 3/3 | 100.0% | 1.543 | 6.00 | 0.00 | 6246d6dbf78b | scripted-playwright-accessibility-human-v2 | none |
| bookstack-open-book | ui-evolution:bookstack-layout-v1 | visual | 3 | 3/3 | 100.0% | 7.215 | 4.00 | 0.00 | 6246d6dbf78b | visual-pss-native-aliyun-qwen3-vl-flash-v2 | none |

**Current total:** 31/36 strict passes across 8 isolated ledgers. Every row has only n=3 per arm/condition; it is not evidence of a general success rate or arm superiority. The paired create-page clean/fault diagnostic is reported separately with verdict coverage; it remains a single-task pilot.

## Historical and excluded ledger inventory

These files are intentionally not pooled with the table above. In particular, legacy schema versions, other provider/model strata, old run tags, tasks, and incomplete blocks retain their original denominators.

| Ledger file | Records | Schema versions | Conditions | Why excluded from current aggregate |
|---|---:|---|---|---|
| bookstack-create-page-clean-stable-aliyun-qwen3-vl-flash-exploratory-500-0001-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3-vl-flash-parallel-feasibility-r1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-admission-bookstack-create-grounded-v2-r2-records.jsonl | 6 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-admission-bookstack-create-grounded-v2-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-admission-bookstack-create-textbox-guard-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-admission-bookstack-create-tool-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-admission-bookstack-create-visual-replan-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-admission-bookstack-grounded-r3-records.jsonl | 9 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-admission-bookstack-grounded-r3-retry-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-admission-bookstack-guard-r2-records.jsonl | 6 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-admission-bookstack-hybrid-guard-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-admission-bookstack-interaction-contract-r2-records.jsonl | 6 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-admission-bookstack-interaction-contract-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-admission-bookstack-json-action-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-attribution-qwen37-v02-baseline-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-attribution-qwen37-v02-grounded-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-attribution-qwen37-v02-grounded-v2-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-exploratory-500-0001-records.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-opt-form-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-phase2-t1-bookstack-create-clean-qwen-schema-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-qwen37-admission-v1-0001-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-qwen37-admission-v3-0001-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-qwen37-controller-debug-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-aliyun-qwen3.7-flash-qwen37-controller-debug-v3-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-deepseek-deepseek-flash-deepseek-create-page-tool-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-clean-stable-deepseek-deepseek-flash-deepseek-create-page-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-functional-fault-persistence-mismatch-aliyun-qwen3.7-flash-phase2-t1-bookstack-create-fault-qwen-schema-records.jsonl | 3 | 0.2 | functional-fault:persistence-mismatch | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-functional-fault-persistence-mismatch-deepseek-deepseek-flash-deepseek-create-page-fault-v1-records.jsonl | 3 | 0.2 | functional-fault:persistence-mismatch | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-create-page-ui-evolution-bookstack-layout-v1-aliyun-qwen3.7-flash-phase2-t1-bookstack-create-evolution-qwen-schema-records.jsonl | 3 | 0.2 | ui-evolution:bookstack-layout-v1 | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-hybrid-title-clear-records.jsonl | 1 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-hybrid-title-clear-retry-records.jsonl | 1 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-hybrid-title-clear-retry3-records.jsonl | 1 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-aliyun-qwen3-vl-flash-exploratory-500-0002-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-aliyun-qwen3-vl-flash-records.jsonl | 6 | 0.1, 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-aliyun-qwen3-vl-flash-v02-parallel-r2-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-aliyun-qwen3.7-flash-admission-bookstack-navigation-qwen37-r3-records.jsonl | 9 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-aliyun-qwen3.7-flash-exploratory-500-0002-records.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-aliyun-qwen3.7-flash-opt-grounded-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-aliyun-qwen3.7-flash-opt-grounded-v1-rerun-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-aliyun-qwen3.7-flash-opt-open-v2-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-aliyun-qwen3.7-flash-phase2-t1-bookstack-clean-qwen-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-aliyun-qwen3.7-flash-phase2-t1-bookstack-clean-qwen-retry-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-aliyun-qwen3.7-flash-phase2-t1-bookstack-clean-qwen-retry3-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-aliyun-qwen3.7-flash-phase2-t1-bookstack-clean-qwen-semantic-schema-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-aliyun-qwen3.7-flash-qwen37-admission-v1-0002-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-aliyun-qwen3.7-flash-qwen37-admission-v3-0002-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-deepseek-deepseek-flash-deepseek-open-book-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-bookstack-deepseek-nav-profile-fix-records.jsonl | 6 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-volcengine-doubao-seed-2-0-pro-260215-records.jsonl | 3 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-records.jsonl | 47 | 0.1 | clean-stable, ui-evolution:bookstack-layout-v1 | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-ui-evolution-bookstack-layout-v1-deepseek-deepseek-flash-deepseek-open-book-evolution-v1-records.jsonl | 3 | 0.2 | ui-evolution:bookstack-layout-v1 | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-ui-evolution-bookstack-layout-v1-records.jsonl | 3 | 0.1 | ui-evolution:bookstack-layout-v1 | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-replay-audit-live.jsonl | 4 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-search-open-book2-clean-stable-aliyun-qwen3-vl-flash-exploratory-500-0003-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-search-open-book2-clean-stable-aliyun-qwen3-vl-flash-webtestpilot-search-r1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-search-open-book2-clean-stable-aliyun-qwen3-vl-flash-webtestpilot-search-stabilized-r1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-search-open-book2-clean-stable-aliyun-qwen3.7-flash-exploratory-500-0003-records.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-search-open-book2-clean-stable-aliyun-qwen3.7-flash-opt-search-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-search-open-book2-clean-stable-aliyun-qwen3.7-flash-qwen37-admission-v1-0003-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-search-open-book2-clean-stable-aliyun-qwen3.7-flash-qwen37-admission-v3-0003-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-search-open-book2-clean-stable-deepseek-deepseek-flash-deepseek-search-book2-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-search-open-book2-clean-stable-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-bookstack-deepseek-search-profile-fix-records.jsonl | 6 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-search-open-book2-clean-stable-manual-ledger-r1-records.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-search-open-book2-clean-stable-manual-ledger-r2-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-three-arm-clean-stable-aliyun-qwen3-vl-flash-outcome-v02-records.jsonl | 9 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-three-arm-clean-stable-aliyun-qwen3-vl-flash-records.jsonl | 24 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-three-arm-clean-stable-aliyun-qwen3.7-flash-attribution-qwen37-framework-fix-v1-records.jsonl | 3 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-three-arm-clean-stable-aliyun-qwen3.7-flash-attribution-qwen37-grounded-v1-records.jsonl | 1 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-three-arm-clean-stable-volcengine-doubao-seed-2-0-pro-260215-outcome-v02-records.jsonl | 9 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-three-arm-clean-stable-volcengine-doubao-seed-2-0-pro-260215-records.jsonl | 24 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-three-arm-ledger.jsonl | 40 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-three-arm-records.jsonl | 73 | 0.1 | clean-stable, ui-evolution:bookstack-layout-v1 | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-three-arm-ui-evolution-bookstack-layout-v1-records.jsonl | 3 | 0.1 | clean-stable, ui-evolution:bookstack-layout-v1 | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-v02-scripted-smoke.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-v02-visual-diagnostic.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| framework-browser-use-v02-records-normalized.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| framework-browser-use-v02-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| framework-browser-use-v02-records.normalized.jsonl | 2 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| framework-stagehand-v02-records.jsonl | 12 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| framework-stagehand-v02-success-normalized.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| framework-stagehand-v02-success-v2.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| framework-stagehand-v02-success-v3-normalized.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| framework-stagehand-v02-success-v3.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| framework-stagehand-v02-success.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-hybrid-title-scope-records.jsonl | 1 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-search-events-clean-baseline-r1-records.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-search-events-clean-baseline-r2-records.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-search-events-clean-r3-hybrid-records.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-search-events-clean-r3-visual-records.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-search-events-replay-instrumentation-v1-visual-records.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-aliyun-qwen3-vl-flash-exploratory-500-0004-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-aliyun-qwen3-vl-flash-parallel-feasibility-r1-records.jsonl | 3 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-aliyun-qwen3-vl-flash-v02-parallel-r2-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-aliyun-qwen3.7-flash-admission-indico-actionability-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-aliyun-qwen3.7-flash-admission-indico-menu-filter-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-aliyun-qwen3.7-flash-admission-indico-structure-hit-test-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-aliyun-qwen3.7-flash-admission-indico-timeout-ladder-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-aliyun-qwen3.7-flash-attribution-qwen37-indico-grounded-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-aliyun-qwen3.7-flash-exploratory-500-0004-records.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-aliyun-qwen3.7-flash-opt-create-v2-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-aliyun-qwen3.7-flash-opt-grounded-v1-rerun-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-aliyun-qwen3.7-flash-phase2-t1-indico-clean-qwen-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-aliyun-qwen3.7-flash-qwen37-admission-v1-0004-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-aliyun-qwen3.7-flash-qwen37-admission-v3-0004-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-deepseek-deepseek-flash-deepseek-indico-event-v1-records.jsonl | 2 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-indico-clean-deepseek-provider-profile-fix-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-indico-clean-deepseek-provider-profile-fix2-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-indico-clean-deepseek-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-indico-deepseek-rep2-records.jsonl | 6 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-ledger.jsonl | 4 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-records.jsonl | 4 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-volcengine-doubao-seed-2-0-pro-260215-clean-v02-records.jsonl | 3 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-aliyun-qwen3-vl-flash-exploratory-500-0005-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-aliyun-qwen3-vl-flash-parallel-feasibility-r1-records.jsonl | 3 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-aliyun-qwen3-vl-flash-v02-provenance-fix-r3-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-aliyun-qwen3.7-flash-admission-juice-submit-only-r2-records.jsonl | 6 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-aliyun-qwen3.7-flash-attribution-qwen37-juice-grounded-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-aliyun-qwen3.7-flash-attribution-qwen37-juice-overlay-clean-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-aliyun-qwen3.7-flash-attribution-qwen37-juice-runnerfix-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-aliyun-qwen3.7-flash-attribution-qwen37-juice-semantic-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-aliyun-qwen3.7-flash-attribution-qwen37-juice-submit-only-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-aliyun-qwen3.7-flash-attribution-qwen37-juice-submit-only-v2-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-aliyun-qwen3.7-flash-opt-search-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-aliyun-qwen3.7-flash-opt-search-v2-records.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-aliyun-qwen3.7-flash-opt-search-v3-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-aliyun-qwen3.7-flash-phase2-t1-juice-clean-qwen-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-aliyun-qwen3.7-flash-qwen37-admission-v1-0005-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-aliyun-qwen3.7-flash-qwen37-admission-v3-0005-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-deepseek-deepseek-flash-deepseek-juice-search-v1-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-juice-clean-deepseek-provider-profile-fix2-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-juice-clean-deepseek-records.jsonl | 3 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-juice-deepseek-rep2-records.jsonl | 6 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-ledger.jsonl | 4 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-records.jsonl | 4 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-volcengine-doubao-seed-2-0-pro-260215-clean-v02-records.jsonl | 3 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-volcengine-doubao-seed-2-0-pro-260215-oracle-poll-v01-records.jsonl | 3 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-volcengine-doubao-seed-2-0-pro-260215-watchdog-v01-records.jsonl | 3 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| live-run-records.jsonl | 4 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| phase2-exploratory-500-blocks-v1-aliyun-qwen3-vl-flash-progress.jsonl | 5 | missing | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| phase2-exploratory-500-blocks-v1-aliyun-qwen3.7-flash-progress.jsonl | 5 | missing | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| prestashop-aliyun-hybrid-matrix-canary10-20260911.jsonl | 10 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| prestashop-aliyun-visual-matrix-canary10-20260911.jsonl | 10 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| prestashop-matrix-aliyun-canary-records.jsonl | 2 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| qwen37-admission-v1-progress.jsonl | 5 | missing | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| qwen37-admission-v3-progress.jsonl | 5 | missing | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| semantic-hybrid-smoke.jsonl | 1 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| validated-run-records.jsonl | 3 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |

## Next evidence requirement

The next scale gate is to reproduce this paired design across additional workflows and SUTs under P1. The navigation task CSS evolution evidence cannot be relabelled as fault evidence.
