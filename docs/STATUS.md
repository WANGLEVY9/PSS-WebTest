# Evidence status and roadmap

**Snapshot: 22 September 2026.** [Project home](../README.md) · [Reproduce](REPRODUCIBILITY.md)

The active authority is [`pss-manuscript-v2.1`](../code/config/study-design-contract.v2.1.json). This page summarizes what repository artifacts support; it does not infer global collection completeness from local visibility.

## Current status

| Area | Supported status | Evidence / remaining boundary |
| --- | --- | --- |
| Study design | Corrected v2.1 contract implemented | WAV 600, VWA 700, ATA 113; 19 configurations; 12 rounds; [active pointer](../code/config/active-study-design.json) |
| RQ1–RQ4 analysis | Formula/input/pipeline implementations and synthetic regression fixtures | [analysis code](../code/local-lab/study-analysis.mjs), [analysis input contract](../code/local-lab/ANALYSIS-AND-ROUTING.md); not execution-level empirical validation |
| Scheduling and input binding | Frozen schedule/source/task correspondence and split actor/evaluator inputs implemented | [remediation report](../code/local-lab/SPONSOR-ADAPTER-PROGRESS-2026-09-22.md); hashes do not prove scientific screening |
| Runtime recovery/accounting | Diagnostic receipts, budget/status separation, recovery and request-accounting checks | [deployment guide](../code/local-lab/SPONSOR-DEPLOYMENT.md); full live adapter acceptance remains open |
| Native framework components | Installed AgentLab/BrowserGym and restricted Browser Use exercised with injected responses | [engineering receipt](../results/local-runtime/2026-09-22-sponsor-adapter-remediation.json); no API calls or benchmark tasks in that receipt |
| ATA official inputs | 113 source cases separated into actor inputs and evaluator references | 62 PASS / 51 FAIL; input preparation is not task execution or label validation |
| Official benchmark integration | Partial; per-site reset, native evaluation and complete action coverage require acceptance | [conformance audit](../results/local-runtime/2026-09-21-benchmark-conformance.json) and [remaining adapter work](../code/local-lab/SPONSOR-ADAPTER-PROGRESS-2026-09-22.md) |
| Sponsor Linux/API acceptance | Not established by the current reports | Reviewed Linux locks, live fixture/adapter checks and exact API bindings still required |
| Historical aggregate results | Available as working analysis history; not a public execution-level replication release | ATA 112-case historical summaries require reconciliation to 113 official cases |
| Public paper / DOI / execution-level package | **Forthcoming** | No acceptance, artifact badge, persistent identifier or complete execution release is claimed |

## What the latest engineering receipt means

### Runtime documentation baseline

The [technical specifications](technical/README.md) describe committed runtime
`de93d32`, with a [native-source traceability matrix](technical/UPSTREAM_TRACEABILITY.md).
Its newer implementation includes a WAV shopping owned lifecycle, VWA live-page
deterministic evaluation, and an ATA reference comparator; those do not establish
full selected-workload acceptance. Judge-dependent VWA tasks and ATA fixture/label
parity remain open. [Qwen live diagnostics](../code/local-lab/QWEN-LIVE-DIAGNOSTICS.md)
use synthetic sites and must not be counted as official benchmark executions.
The later [WAV100 plan](../code/local-lab/WAV100-QWEN38MAX-PLAN.md) adds a separate
bounded official task-260 probe and a 100-task Shopping development selection.
Its 400 planned opportunities are not a completed-run count or full workload
admission; its targeted reset probes do not certify all mutable state.

The CNY 1,500 shared-budget implementation and stronger task-bound receipts are
on the separate `codex/sponsor-acceptance-bound-input` branch. They are **not
integrated** into this runtime baseline. The [cost integration matrix](technical/RUNTIME.md)
records that gap; before any sponsor release, all provider and evaluator requests
must pass the unified budget gate. The [cloud handoff](../code/local-lab/cloud-handoff/README.md)
contains installation, dependency and evidence-return requirements, not a passed
cloud acceptance certificate.

### Earlier source-hashed receipts

The dated [22 September remediation receipt](../results/local-runtime/2026-09-22-sponsor-adapter-remediation.json) reports **429 passed offline checks**: 103 local Node/browser, 284 source-only contract, 39 runtime Python and 3 ATA input-projection checks. Four historical artifact-integration files were not run. This is a historical, source-hashed verification result, not a hardcoded expectation for every later checkout.

Its framework probes used installed AgentLab 0.4.2 / BrowserGym core 0.14.2 and Browser Use 0.13.10 with deterministic injected responses. Both report `benchmark_adapter_admitted=false`. The receipt records zero model requests, zero benchmark executions and `confirmatory_authorized=false`. These distinctions are part of the result.

There may be existing executions elsewhere; lack of local source records does not prove that no collection occurred. Conversely, working manuscript tables or reported cloud collection do not establish imported, validated or publicly reproducible execution coverage.

## Presentation-refresh verification

A fresh [local source-snapshot check](verification/offline-2026-09-22.json) ran 440 tests: 108 local Node/browser, 284 source-only contracts, 45 runtime Python and 3 ATA projection checks; all passed. It included pre-existing working-tree changes and reused the developer installation of Node dependencies. This verifies the documented offline command against that snapshot, not a clean Linux installation or a GitHub Actions run. Model requests and official benchmark executions were zero.

## Technical-documentation verification

The [documentation receipt](verification/documentation-2026-09-22.json) records
local link/heading and active-design checks, dependency inventory hashes, three
negative controls, and rendering of 13 Mermaid diagrams. No model calls, official
benchmark executions or cloud installations were performed for this documentation
change. This is separate from runtime or empirical acceptance.

## Important corrections

- **ATA:** the published population used by v2.1 is 113 cases, 62 PASS / 51 FAIL. Earlier 112 and 56/56 descriptions are superseded. Preserve acquisition-time protocols and reconcile identities; never add a fabricated row or reassign labels to make totals match.
- **RQ3:** use comparator minus visual **correctness**, with same-class discovery-correct controls and excess gain. Earlier exports with reversed error-rate signs require reanalysis from source rows.
- **RQ4:** current analysis uses two five-round validation windows, the joint-availability threshold and first available per-configuration/window outcomes. Earlier discovery-group or fixed-six-repeat mock exercises do not establish this result.
- **Frameworks:** a custom PSS driver cannot be relabeled AgentLab; stock BrowserGym WebArena and WebArena-Verified are not interchangeable because task numbers look similar.
- **Reporting:** the current manuscript uses descriptive estimates. Earlier inferential plans remain history; do not manufacture significance from rounded tables.

## Roadmap

| Workstream | Next verifiable outcome |
| --- | --- |
| Complete official task adapters | Images, uploads, multipage workflows, permitted observations/actions and replay evidence pass benchmark-specific acceptance |
| Close environment acceptance | Dedicated fixtures demonstrate reset before each arm/round, unchanged peers, native evaluator controls and quarantine/recovery |
| Validate the target host | Reviewed native Linux locks and actual sponsor-host installation, dependency, fixture and API checks |
| Bind a campaign | Verified official selected IDs, blinded human preparation, exact framework/model identities and prospectively fixed matched budgets |
| Reconcile prior data | Imported source executions retain original provenance; ATA correction and current estimands are recomputed without filling gaps |
| Release a replication package | Reviewed redacted execution-level inputs, reproducible commands, documented exclusions and an actual persistent release identifier |

The engineering gates above test valid measurement and execution, not whether a method achieves a high score. Method failures remain outcomes when the environment and measurement are valid.

## Contribute a bounded improvement

Useful contributions include a reproducible evaluator negative control, an observation-boundary test, a platform-specific installation report, a missing-data analysis fixture, or a documentation/command correction. Include source versions and the evidence kind. See [CONTRIBUTING.md](../CONTRIBUTING.md).
