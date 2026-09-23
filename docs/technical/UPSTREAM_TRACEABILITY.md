# Upstream-to-implementation traceability

[Technical index](README.md)

Review baseline: committed PSS runtime `de93d32`, 22 September 2026. Benchmark
commits are immutable source references. Framework tags identify the reviewed
version; actual installed distributions and source/browser hashes still need
binding. Links to living Playwright docs are semantic references, not version locks.

| Native source | Requirement being preserved | Project mapping | Evidence still required |
|---|---|---|---|
| [WAV README, fixed commit](https://github.com/ServiceNow/webarena-verified/blob/6473f72db5dcefc97b5725b59e734504edc28a21/README.md) | Official task + original structured answer + network evidence | [WAV design](benchmarks/WAV.md), `wav_native_evaluate.py` | Selected site closure, original HAR and native positive/negative controls per admitted fixture |
| [WAV response type](https://github.com/ServiceNow/webarena-verified/blob/6473f72db5dcefc97b5725b59e734504edc28a21/src/webarena_verified/types/agent_response.py) | Typed response fields/status semantics | [Output contract](INPUT_OUTPUT.md), `benchmark_output_contract.py` | Actual unmodified completion bytes; no reference-guided repair |
| [VWA README](https://github.com/web-arena-x/visualwebarena/blob/89f5af29305c3d1e9f97ce4421462060a70c9a03/README.md) | Public images, generated task configs and authenticated environments | [VWA design](benchmarks/VWA.md), `prepare_navigation_runtime.py` | Linux install, all required image bytes/MIME and site authentication |
| [VWA environment setup](https://github.com/web-arena-x/visualwebarena/blob/89f5af29305c3d1e9f97ce4421462060a70c9a03/environment_docker/README.md) | Correct stateful site data and reset | `vwa_reset_contract.py`, [cloud runbook](../../code/experiment/cloud-handoff/README.md) | Actual owned restore backend; HTTP success alone is insufficient |
| [VWA evaluator router](https://github.com/web-arena-x/visualwebarena/blob/89f5af29305c3d1e9f97ce4421462060a70c9a03/evaluation_harness/evaluators.py) | Task-specific final-page/answer/visual assessment | `vwa_native_evaluate.py` live evaluation then sealed consumption | Native judge/captioning paths remain blocked until configured and audited |
| [piñata evaluation workflow](https://github.com/Smartesting/pinata/blob/650b9edaa055915cb27d2498f379a66430cc3e02/evaluation.py), [published artifact](https://zenodo.org/records/15198569) | Original cases, reference verdicts, failure-step semantics and state | [ATA design](benchmarks/ATA.md), `ata_native_evaluate.py` | Independent fixture/label parity; reference comparator is not the upstream runtime oracle |
| [AgentLab v0.4.2](https://github.com/ServiceNow/AgentLab/blob/v0.4.2/README.md), [GenericAgent](https://github.com/ServiceNow/AgentLab/blob/v0.4.2/src/agentlab/agents/generic_agent/generic_agent.py) | Real framework decision component and declared reproducibility policy | [AgentLab design](frameworks/AGENTLAB.md), `framework_agentlab.py` | Per-step restriction audit and PSS lifecycle conformance; no stock-score reproduction claim |
| [BrowserGym v0.14.2](https://github.com/ServiceNow/BrowserGym/tree/v0.14.2) | Distinguish core actions, environments, task setup and rewards | [BrowserGym design](frameworks/BROWSERGYM.md) | Same task/evaluator identity; stock WA registration cannot substitute for WAV |
| [Browser Use 0.13.10 Agent](https://github.com/browser-use/browser-use/blob/0.13.10/browser_use/agent/service.py) | Real decision/schema API with explicit adaptation | [Browser Use design](frameworks/BROWSER_USE.md), `framework_browser_use.py` | Default loop/tools/fallback remain excluded; restricted observation/action acceptance |
| [Playwright actionability](https://playwright.dev/docs/actionability), [Trace Viewer](https://playwright.dev/docs/trace-viewer) | Actual browser interactions, waits and trace inspection | [Playwright design](frameworks/PLAYWRIGHT.md), `traditional_actor.py` | Frozen browser, complete journals, blinded human authoring and benchmark-native assessment |

## Comparison claims permitted by this mapping

- A source-pinned native endpoint can support within-study comparisons when
  task selection, fixture state and coverage are reported.
- Our actor restrictions, task subsets and repetition design differ from upstream
  default experiments. They must be disclosed before any comparison to published
  scores. Shared names and identical source counts are not experimental parity.
- Full reproduction requires matching the upstream population, environment,
  observation/action protocol, models, budgets, aggregation and missingness policy.
  Where those differ, report a controlled adaptation, not reproduced performance.
- Installed/imported, component-tested, provider-tested, official-canary-tested
  and formally admitted are separate evidence levels. No link in this table
  substitutes for a measured receipt.

## Maintenance checklist

For an upstream version change, retain the old lock/receipt, compare native
task/evaluator/action semantics, update the relevant source row, regenerate the
dependency inventory, rerun boundary/positive-negative controls and validate
the target host. A silent latest-version upgrade is not a documentation fix.
