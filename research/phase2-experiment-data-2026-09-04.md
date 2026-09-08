# Phase 2 experiment data ledger — 2026-09-04

**Generated:** 2026-09-08T06:43:02.813Z  
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
| bookstack-navigation-clean-stable-aliyun-qwen3-vl-flash-records.jsonl | 6 | 0.1, 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-clean-stable-volcengine-doubao-seed-2-0-pro-260215-records.jsonl | 3 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-records.jsonl | 47 | 0.1 | clean-stable, ui-evolution:bookstack-layout-v1 | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-navigation-ui-evolution-bookstack-layout-v1-records.jsonl | 3 | 0.1 | ui-evolution:bookstack-layout-v1 | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-three-arm-clean-stable-aliyun-qwen3-vl-flash-outcome-v02-records.jsonl | 9 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-three-arm-clean-stable-aliyun-qwen3-vl-flash-records.jsonl | 24 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-three-arm-clean-stable-volcengine-doubao-seed-2-0-pro-260215-outcome-v02-records.jsonl | 9 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-three-arm-clean-stable-volcengine-doubao-seed-2-0-pro-260215-records.jsonl | 24 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-three-arm-ledger.jsonl | 40 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-three-arm-records.jsonl | 73 | 0.1 | clean-stable, ui-evolution:bookstack-layout-v1 | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-three-arm-ui-evolution-bookstack-layout-v1-records.jsonl | 3 | 0.1 | clean-stable, ui-evolution:bookstack-layout-v1 | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-v02-scripted-smoke.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| bookstack-v02-visual-diagnostic.jsonl | 1 | 0.2 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-ledger.jsonl | 4 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-records.jsonl | 4 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| indico-three-arm-volcengine-doubao-seed-2-0-pro-260215-clean-v02-records.jsonl | 3 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-ledger.jsonl | 4 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-records.jsonl | 4 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-volcengine-doubao-seed-2-0-pro-260215-clean-v02-records.jsonl | 3 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-volcengine-doubao-seed-2-0-pro-260215-oracle-poll-v01-records.jsonl | 3 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| juice-shop-three-arm-volcengine-doubao-seed-2-0-pro-260215-watchdog-v01-records.jsonl | 3 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| live-run-records.jsonl | 4 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |
| validated-run-records.jsonl | 3 | 0.1 | clean-stable | Different run tag, protocol, task, provider/model, or an incomplete cell; catalogued but not pooled. |

## Next evidence requirement

The next scale gate is to reproduce this paired design across additional workflows and SUTs under P1. The navigation task CSS evolution evidence cannot be relabelled as fault evidence.
