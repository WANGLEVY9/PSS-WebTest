# Three-benchmark conformance audit and repair

Status: **not admitted; batch collection remains paused**. No model requests or new benchmark-task executions in this repair round. Engineering tests are not empirical success observations. This document does not amend the human-confirmed v1.0 design.

## Authority and non-negotiable boundaries

Use the pinned official artifacts for task identity, fixture semantics, reset and evaluation. Use the separately declared PSS protocol for controlled observation/action budgets and comparative arms. A custom Qwen PSS agent is **not** a reproduction of the official paper's agent/model baseline. Deviations must be explicit rather than concealed by a successful score.

- [WebArena-Verified pinned source](https://github.com/ServiceNow/webarena-verified/tree/6473f72db5dcefc97b5725b59e734504edc28a21): deterministic evaluation over response and HAR; site lifecycle contract at `src/webarena_verified/environments/site_handler.py`. Its reset describes stop/recreate/initialize. Merely opening a fresh anonymous browser is not equivalent.
- [VisualWebArena pinned setup](https://github.com/web-arena-x/visualwebarena/tree/89f5af29305c3d1e9f97ce4421462060a70c9a03): README, `environment_docker/README.md`, `prepare.sh`, task images and original evaluator. Python 3.10/3.11; site login and reset instructions are site-specific. Captioner/VQA requirements depend on the evaluator/task. DOM-derived Set-of-Mark and caption-augmented baselines cannot be called our pixel-only condition.
- [ATA published artifact](https://zenodo.org/records/15198569), DOI 10.5281/zenodo.15198569: bundled PinATA is the April 2025 artifact, not interchangeable with a later separately pinned Git checkout. Its `pinata/evaluation.py` dispatches remote GitHub reset workflows; we did not invoke these. Published P/F labels are reference outcomes, not agent predictions, but their validity in a local fixture must still be demonstrated.

Each selected task must have its complete site/asset/authentication dependency closure verified. One running site does not admit an entire benchmark. A globally unnecessary site must not be used as a post-outcome exclusion; screening decisions are outcome-blind and require the frozen review process.

## Current verification versus missing proof

| Benchmark | Verified here | Still blocking formal collection |
|---|---|---|
| WebArena-Verified | Source commit matches; tracked source unchanged; Shopping image pinned; existing original-evaluator diagnostic ledger validated | Database-reset cycles and fingerprints; more than read-only Shopping retrieval; task dependency closure; evaluator edge cases; blinded Traditional authoring |
| VisualWebArena | Source commit matches; tracked source unchanged; official Classifieds archive prepared; isolated compose available | Image deployment completion/pinning, fixture/login/reset parity, task reference-image adapter, original evaluator runtime, three-arm integration |
| ATA | Source commit matches; tracked source unchanged; published CSV parsing and gold/specification separation | 112 versus 113 inventory amendment and duplicate source indices, live fixtures matching labels, reset equivalence, original evaluation-semantics parity and live adapters |

`conformance-audit.mjs --write` rechecks source pins and image presence and exports a sanitized timestamped report. Its explicit unresolved checklist is a human-audited snapshot, **not an automated proof** of every gate. It cannot authorize collection. The console exposes benchmark-specific and common open gates.

## Repairs and calibration

1. v6 documents independent normalized x/y axes and signed CSS-pixel scrolling in prompt and schema. Shared coordinate mapping is calibrated on a synthetic Chromium page (four corners plus center; positive, negative and zero scrolling). Mapping is unchanged: `(695,431)` remains `(890,310)` at 1280×720. No DOM snapping, alternate coordinate interpretation, automatic sign flip, task plan, answer or matching-review hint was added.
2. New records use `preparation_passed/preparation_digest`; `reset_passed/reset_digest` stay null until real reset proof exists. Historical records remain immutable; the validator and UI interpret their old reset fields as preparation, not proof.
3. Runner rejects modified tracked official source as well as commit mismatch. This is necessary but does not verify all installed dependencies or generated/untracked task artifacts.
4. ATA actor packets use a nested allowlist. Extra gold/source metadata on steps is discarded; a regression verifies that changing labels/failure annotations cannot change the public specification packet. Assertions explicitly provided by the official task are retained. No current task set was silently changed.
5. Existing screenshot-only readiness policy remains bounded and explicitly **does not prove semantic loading**. Hybrid retains the frozen visible-interactable projection; no full DOM/static-text dump is added to rescue failed answers. Observer URL/HAR/evaluator information remains outside model messages.

## Required next sequence

1. Complete isolated official environment deployment and image/fixture provenance. Do not substitute WAV's revised Shopping image for VWA/ATA without demonstrated equivalence and a documented decision.
2. Three reset cycles per admitted dependency closure: known local fixture state, controlled change, native reset, state restoration fingerprint and isolation evidence. Perform on dedicated test instances; never dispatch upstream public reset workflows.
3. Independent evaluator checks with known-positive/known-negative engineering fixtures. Preserve original evaluator errors, including answer-dependent errors; do not remove them as external infrastructure by default or patch gold/answers to make tests pass.
4. Adapter input/control-flow audits: VWA reference images, screenshot-only Visual; bounded Hybrid projection; ATA specification versus gold isolation; fair scripts with reviewer/cost ledger. Unit checks are not sufficient evidence of live adapter conformance.
5. Complete two-person outcome-blind task screening and freeze populations; complete blinded Traditional adaptation. Current AI-assisted diagnostic scripts are not the formal human-authored baseline.
6. Freeze runtime/prompt/budget/retry versions, pilot and power plan, then seek explicit formal authorization. Protocol versions are separate strata. Method failures remain outcomes; high success rate is never an admission criterion.

## Verification this round

- Local Node suite: 32/32, including synthetic Chromium calibration and delayed-render tests.
- Existing contract suite: 287/287.
- ATA parser/boundary suite: 3/3.
- No v6 benchmark execution or model-performance improvement is claimed.
- Existing ledger: 5 batches / 33 records, zero validator errors. No historical outcomes were changed.
- Console checked in Chromium: v6 next protocol, collection disabled, 0 admitted benchmarks, four expandable gate lists, no page errors.
- Official VWA image pull `vwa-pull-1789979942465` ran 08:39:02–08:49:02 UTC and reached the 600-second limit (`ETIMEDOUT`, exit 130); no Classifieds deployment or reset success is claimed. This is an environment provisioning blocker, not a Visual/Hybrid method failure.

All source/fixture/evaluator observations are separate from task-screening decisions. Existing exposed development tasks cannot be presented as an untouched confirmatory population.
