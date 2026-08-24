# Benchmark replication and task-expansion plan (2026-08-24)

## Scope

This document records how PSS-WebTest will borrow design ideas from post-2023 public benchmarks without confusing benchmark success with software-test validity. The machine-readable admission record is `code/config/replication-subset.v0.1.json`.

The study remains a matched three-arm comparison:

1. pure-visual CUA: screenshot only;
2. hybrid agent: screenshot plus the allowlisted `pageStructure` contract;
3. accessibility-locator Playwright: deterministic locator-based script.

The outcome is conditional behavior across task and UI conditions, not a universal winner. Each task must be executed from a reset state and judged by an evaluator independent of the agent's emitted verdict or hidden application state.

## What was inspected locally

The vendored WebTestPilot artifact is not merely a paper citation. Its repository contains 27 BookStack test cases and 27 corresponding bug scripts, 25 Indico cases and 25 bug scripts, 23 PrestaShop cases and 23 bug scripts, and 25 Invoice Ninja cases and 25 bug scripts. Representative source cases were read directly:

- `benchmark/bookstack/test_cases/create_page.yaml`: five-step create-and-persist workflow with explicit Playwright assertions.
- `benchmark/bookstack/test_cases/search.yaml`: navigation/search consistency workflow.
- `benchmark/indico/test_cases/create_lecture.yaml`: event creation with typed-field and final-list expectations.
- `benchmark/indico/test_cases/edit_conference.yaml`: cross-page edit, save, revisit, and preservation expectations.

The repository states CC BY 4.0 in its `LICENSE`. We therefore retain the source under `third_party/`, preserve attribution, and do not copy raw cases into the public PSS-WebTest task corpus. The project-owned adaptation is represented by task blueprints and independent oracles. A source case can enter a pilot only after reset, matching, oracle, and mutation-isolation gates pass.

## External design references and intended reuse

| Source | Design borrowed | Boundary in this study |
|---|---|---|
| WebArena (2023) | self-hosted applications, long-horizon workflows, functional postconditions | use as task-length/evaluator reference; no direct task pooling |
| VisualWebArena (2024) | visually grounded image-text tasks | use for visual-grounding strata and layout changes; not a testing oracle |
| BrowserGym/AgentLab (2025 ecosystem) | common task interface, modality separation, trace/evaluation provenance | use for harness provenance and contract vocabulary |
| WorkArena/WorkArena++ (2024) | atomic-to-compositional difficulty levels | use for pre-registered difficulty labels; gated ServiceNow instances are not local SUTs |
| Online-Mind2Web (2025) | live-task diversity and maintenance concerns | use as maintenance/drift motivation; live sites are not deterministic SUTs |
| WebTestPilot (2026) | natural-language test intent, bug-injected applications, step expectations | locally adapt selected BookStack/Indico intents; keep independent visible/persisted-state oracle |
| WebTestBench (2026) | functionality/constraint/interaction/content outcome vocabulary | use as collision and latent-constraint reference; do not pool results because protocols differ |

## Replication subset and order

The first local replication is the WebTestPilot BookStack create-page intent because the source case and bug script are present and our SUT reset/oracle path already exists. It is a pilot adaptation, not a claim of reproducing the WebTestPilot result. The next candidate is search, then Indico create-lecture after authenticated fault workflow evidence is complete. PrestaShop and Invoice Ninja remain excluded from the confirmatory scope until platform/license/runtime audits are completed.

Difficulty labels are attached before collection:

- `L1`: one-page navigation or a single visible postcondition;
- `L2`: cross-page navigation or form submission;
- `L3`: persistence, revisit, negative control, or role boundary;
- `L4`: fault/evolution condition requiring repair or causal oracle evidence.

## Admission and analysis rules

The following are gates, not post-hoc filters: verified source/license, deterministic reset, matched natural-language intent, independent oracle, fault/evolution isolation, and immutable run-record provenance. Infrastructure failures and provider failures remain separate categories. A cell is admitted only when reset succeeds, the agent completes the task protocol, and the independent oracle passes. Oracle-only success after an agent timeout is not a cell pass.

For each admitted case, collect valid completion, joint end-to-end correctness, oracle false-positive/false-negative counts where a labeled fault exists, action count, wall-clock latency, retries, token/cost fields when available, repair effort, and repeated-run stability. Pilot variance is descriptive until the task strata and model/provider configuration are frozen; it cannot start confirmatory collection.

## Current status

The BookStack navigation task has passed clean and layout-evolution pilot runs for all three arms. The create-page task has shown run-to-run provider variance, so its result remains pilot evidence. The replication manifest and local source audit are complete; the external benchmark cases are not yet admitted as confirmatory samples.
