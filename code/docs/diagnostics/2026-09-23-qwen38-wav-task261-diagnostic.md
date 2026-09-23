# Official WAV task 261: Qwen 3.8 diagnostic audit

Status: **diagnostic only**. This is one official WebArena-Verified Shopping task,
not eleven independent tasks or a confirmatory comparison. The companion JSON
contains report/configuration digests and per-attempt lifecycle classifications;
raw prompts, images, traces, evaluator gold, credentials, and HAR are not
published. Each attempt had its own owned fixture and native evaluation.

| Arm / model | Framework | Attempts | Native scores | Observed boundary |
| --- | --- | ---: | --- | --- |
| Traditional | Playwright | 5 script versions | 0, 0, 0, 0, 0 | Locator timeout; script execution/deployment failure retained |
| Pure visual / Qwen 3.8 Max | AgentLab | 1 | 0 | Actor completed, official oracle did not accept outcome |
| Hybrid / Qwen 3.8 Max | AgentLab | 1 | 0 | Actor completed, official oracle did not accept outcome |
| Hybrid / Qwen 3.8 Max | restricted Browser Use | 1 | 0 | Actor completed, official oracle did not accept outcome |
| Pure visual / Qwen 3.8 Flash | AgentLab | 1 | 0 | Invalid model action syntax after 3 accepted actions |
| Hybrid / Qwen 3.8 Flash | AgentLab | 1 | 0 | 24-action budget exhausted |
| Hybrid / Qwen 3.8 Flash | restricted Browser Use | 1 | 0 | Actor declared success on a visually relevant filtered page, but the official navigation-event oracle scored 0 |

All 11 processes completed fresh reset, actor termination, native scoring,
replay-integrity audit, and owned cleanup without an engineering exception.
Six agent attempts have interpretable task outcomes under the conservative
diagnostic rule. The five Traditional script timeouts are **not discarded**:
they remain explicit Traditional deployment-effectiveness failures, while not
being reclassified as successful capability executions. Multiple repaired
scripts for the same task must not be counted as independent repetitions.

The Traditional sequence is auditable. Two earlier scripts and v5 attempted
menu-item hover and timed out. v5 repeats the earlier approach rather than
constituting a new task. v6 hovered the visible Electronics link and then
timed out on Headphones. v7 clicked the Electronics link successfully and
then timed out on a Headphones link. The v6/v7 changes used Traditional-side
DOM and screenshots only; they are explicitly AI-assisted diagnostic repairs,
not a blinded human-authored confirmatory baseline. **No further Traditional
adaptation to this task should use the now-inspected evaluator expectation.**

The Flash Browser Use trace reached a page with Headphones products and an
active category filter; its own answer reported success. Native evaluation
accepted the response format but rejected the required network-navigation
event. Thus score 0 is neither a provider outage nor evidence that no
semantically related page was reached. It is a concrete task/oracle mismatch
that should be reported under testing correctness. We keep the official score
unchanged, and do not alter an arm's observations to force a pass.

These attempts cannot be pooled with the earlier tasks 260/274 as a balanced
formal comparison: they have different source snapshots, ad hoc Traditional
repair versions, one repetition per agent configuration, and only targeted
reset/peer-content proof rather than full mutable-state isolation. The next
scientific gate is independent full-state closure and frozen, outcome-blind
Traditional adaptation across the frozen task set; until then bulk and
confirmatory admission remain false.
