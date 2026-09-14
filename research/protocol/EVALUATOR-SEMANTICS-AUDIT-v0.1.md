# Evaluator semantics audit v0.1

Date: 2026-09-14

Status: **source-level audit only; no environment, task arm, or study outcome has run**

This audit asks a narrow question: whether the official evaluation pathway can
serve as a hidden, method-independent endpoint for the three study arms. A
source fingerprint is not evidence of semantic equivalence or deployment
readiness.

| Benchmark | Source-level evaluator inputs | Provisional interpretation | Blocking follow-up |
|---|---|---|---|
| WebArena-Verified | `WebArenaVerifiedEvaluator.evaluate_task` consumes an official task, agent response, and captured network trace; registered evaluators structurally compare response and network-event assertions. | Candidate post-hoc independent evaluator, provided that all evaluator configuration and network trace are withheld from every arm. | Install the pinned environment; run official fixture/negative evaluator checks; prove the trace collector is arm-neutral. |
| VisualWebArena | The evaluation harness receives a Playwright `page` plus official configuration. Its evaluator families inspect URL, HTML/locator content, and images. | Candidate post-hoc independent evaluator, provided that only a separate evaluator context receives its locator/configuration fields. | Reproduce the official environment; verify evaluator context separation and reset behavior before adapter design. |
| ATA / PinATA | `evaluation.py` resets a remote public application via GitHub Actions, then constructs its own `Browser` and `Orchestrator`; the stored `execution_result.status` comes from the benchmark Actor/Assertor pipeline. | **Not yet a shared external oracle.** It is a benchmark-specific agent-testing pipeline whose endpoint may be coupled to an LLM/assertor and remote reset service. | Decide, before screening, whether an unchanged official ATA endpoint can meet the study oracle definition. If not, document a protocol-preserving role or exclude ATA from the common-effect denominator rather than silently substituting a new oracle. |

## Evidence inspected

- WebArena-Verified: `src/webarena_verified/api/internal/evaluator.py`,
  `core/evaluation/evaluators/agent_response_evaluator.py`, and
  `network_event_evaluator.py` at pinned commit
  `6473f72db5dcefc97b5725b59e734504edc28a21`.
- VisualWebArena: `evaluation_harness/evaluators.py` at pinned commit
  `89f5af29305c3d1e9f97ce4421462060a70c9a03`.
- PinATA: `evaluation.py` and `src/VTAAS/workers/assertor.py` at pinned commit
  `650b9edaa055915cb27d2498f379a66430cc3e02`; the published ATA archive was
  also checksum-verified.

## Local non-arm verification

The pinned WebArena-Verified source was installed in an ignored local Python
3.11 environment using `uv`. These official source tests completed without a
study arm, browser task, or local WebArena site:

- `tests/core/evaluation/test_value_comparator.py`: **98 passed**;
- `tests/api/test_evaluation_api_retrieval_tasks.py` plus
  `tests/api/test_evaluation_api_navigation_tasks.py`: **3,273 passed,
  6,387 skipped**.

The skipped API cases remain environment-dependent and therefore do not count
as a reset, evaluator, or benchmark-admission success. This result establishes
only that the pinned evaluator source and its offline fixtures are executable
on the current machine.

## Non-negotiable boundary

For WebArena-Verified and VisualWebArena, evaluator-only material may be
collected after an arm terminates but must never become input to the CUA,
Hybrid, or Traditional runner. For ATA, no arm adapter may be built until the
shared-oracle and reproducible-reset questions above are resolved in the
frozen protocol.
