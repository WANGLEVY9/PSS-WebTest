# Research design and analysis map

Implementation companion: [testing paradigms](technical/TESTING_PARADIGMS.md), [input/output contracts](technical/INPUT_OUTPUT.md), and [upstream requirements matrix](technical/UPSTREAM_TRACEABILITY.md). Benchmark populations come from pinned sources; selected counts are design targets and require actual frozen IDs. Native endpoint compatibility does not imply comparability with a published score under a different task subset, actor, observation or budget.

[Project home](../README.md) · [Reproduce](REPRODUCIBILITY.md) · [Status](STATUS.md)

The current design is selected by [`active-study-design.json`](../code/config/active-study-design.json), which points to [`study-design-contract.v2.1.json`](../code/config/study-design-contract.v2.1.json). Earlier contracts are retained for history, not current execution authority. Adoption inside this repository is not external preregistration.

## Design at a glance

| Dimension | Active design |
| --- | --- |
| Core workloads | WAV 600; VWA 700; ATA 113, with 62 PASS and 51 FAIL |
| Configuration matrix | Six model labels × AgentLab visual/hybrid and restricted Browser Use hybrid; one shared Playwright script |
| Scheduled opportunity | Benchmark × official task × configuration × round |
| Repetition | D1–D2 discovery and V1–V10 validation on the same tasks |
| Planned denominator | 1,413 tasks × 19 configurations × 12 = 322,164 opportunities |
| Native outcomes | Source-specific task success or ATA verdict/step correctness |
| Operational outcomes | Fixed selected workload, including preparation failure and unresolved opportunities |
| Reporting | Descriptive estimates, coverage and identification bounds |

The six display labels are GPT-6 Astra, GPT-5.6 Sol, Qwen3.8-Max, Qwen3.8-Flash, Claude Sonnet 5 and Gemini 3.8 Flash. Their order determines `v1/h1/u1` through `v6/h6/u6`. These are contract labels, not a claim that each model/API/configuration has been accessed or measured. Preserve requested and returned model identities, provider, framework, prompt/action/image settings and protocol for any actual campaign.

The script baseline is shared across comparisons; duplicating its rows per model does not create independent evidence. RQ1 includes `u` to examine framework dependence. RQ2–RQ4 concentrate on `v→h` and `v→s`. Because Browser Use has no visual-only cell, this is a partial framework/input crossing.

## Information boundaries

| Approach | Available to the executor | Withheld |
| --- | --- | --- |
| Visual | Screenshot, cursor/viewport state, accepted-action history, action errors and remaining budget | DOM/AX, external OCR, selectors, network payloads, hidden application/evaluator state |
| Hybrid | Visual inputs plus temporary target ID, role, accessible name, visible value/state and bounding box | Raw HTML, hidden/off-screen text, stable application IDs, CSS/XPath, private APIs, evaluator state |
| Scripted | Public DOM/AX properties, visible state and normal browser events during blinded human preparation | Evaluator implementation, reference answers, private API/database truth, agent traces |

A restricted framework adapter must enforce the contract even when upstream defaults expose more information. Valid schemas alone do not prove visibility, occlusion or full browser-action conformance. See [framework remediation](../code/local-lab/SPONSOR-ADAPTER-PROGRESS-2026-09-22.md).

## RQ1: benchmark-native effectiveness

WAV uses a template-macro success rate per round, then equal weight across scheduled rounds. VWA uses task success per round, then equal-round averaging. An entirely unscorable scheduled round is unavailable, not an implicitly removed denominator.

ATA treats **failure as the positive class**: TP is a correct fail verdict, FN is a false pass, TN a correct pass and FP a false alarm. Report binary coverage and unresolved/no-verdict outcomes beside accuracy, sensitivity and specificity. Correct fail verdicts additionally require step classification: earlier (`AFB`), exact (`AFC`), later (`AFA`) or unresolved alignment (`Ustep`). Correct verdicts do not imply correctly identified failure steps.

Do not combine WAV/VWA task success and ATA verdict accuracy into a cross-benchmark success score. The [analysis implementation](../code/local-lab/study-analysis.mjs) and [input contract](../code/local-lab/ANALYSIS-AND-ROUTING.md) define concrete denominators.

## RQ2: the selected workload under repeated use

Keep all selected task × round opportunities. Unprepared tasks and known operational failures count as zero; genuinely unresolved opportunities stay unknown and produce lower/upper bounds. Native acceptance does not override a timeout or invalid operational termination.

Classify tasks as unprepared, unresolved, always-correct, always-incorrect or mixed, preserving twelve opportunities per task. Report preparation coverage and labor separately from execution cost and latency. Authoring, debugging and review include unsuccessful preparation. Missing usage or billing data are unavailable, not zero. A script synthesized for development is not evidence of the blinded human-authored baseline.

## RQ3: recurring errors and same-class controls

D1–D2 select a visual configuration's discovery-error cases: at least one false pass or false alarm. Discovery-correct controls have the same reference class, both discovery outcomes available and no corresponding error. V1–V10 contribute fresh paired binary outcomes; a retained case requires at least one same-round joint observation.

For cohort K, compute each case's validation mean of `alternative_correct − visual_correct`, then average cases equally. Error-cohort gain minus same-class control gain is **excess gain**. It is a descriptive contrast between outcome-selected groups, not a causal effect of previous errors.

Preserve discovered/retained counts and shared observations. Whole-case omission bounds assign an omitted case a contrast in [−1, 1]; they do not resolve missing rounds inside retained cases or uncertainty in the control contrast.

## RQ4: mixing versus two retry controls

Use validation windows V1–V5 and V6–V10. Eligibility requires at least eight jointly assessed binary validation observations and an available outcome for each configuration in both windows. For each configuration/window, select its first available outcome. Selected rounds may differ between configurations.

For a retained case's four results `(c1, c2, d1, d2)`:

```text
mixed  = (max(c1, d2) + max(c2, d1)) / 2
retry_c = max(c1, c2)
retry_d = max(d1, d2)
```

Aggregate all three on the **same retained blocks**: WAV template-macro; VWA/ATA case-macro. The margin over the better retry is `U_mixed − max(U_retry_c, U_retry_d)`. Mixing averages two alternative two-execution strategies; it does not take a union of all four attempts.

The binary identity `max(x,y) = (x+y+|x−y|)/2` decomposes gains into an accuracy difference and disagreement beyond the corresponding same-configuration retry. Analyze ATA pooled and within each reference class. Two attempts need not have equal dollar cost. This offline comparison does not evaluate a deployed router, live verdict selector or continuation from a failed browser state.

## Scope of the evidence

Historical aggregate tables reproduce arithmetic, not individual trajectories, labels, actual API identities or blinded preparation. Internal mock datasets are discussion fixtures and remain outside the public execution evidence. In particular, the earlier six-repeat mock exercise does not implement the current twelve-round design or the revised RQ3/RQ4 estimands.

ATA v2.0's 112-case aggregates must be reconciled to the v2.1 113-case source population before updated empirical conclusions. Do not fill the additional case with an invented outcome or change only a denominator. WorkArena++ and the earlier five local applications are outside the current core study.
