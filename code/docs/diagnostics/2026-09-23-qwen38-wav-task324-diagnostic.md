# Official WAV task 324: search-plus-sort Qwen diagnostic

Status: **diagnostic only**. Task 324 was already in the frozen 100-task
WebArena-Verified development list. Its public intent is to show all chairs
listings sorted by ascending price. This is a new workflow shape (search,
sort selection, direction) rather than a local synthetic substitute. All
seven valid arm executions used fresh owned Shopping fixtures, the same
official input, the same 180-second / 24-action actor budget, native scoring,
replay integrity audit and owned cleanup. No confirmatory admission or
full-state isolation claim is made.

| Arm / model | Framework | Native score | Validity and observed milestone |
| --- | --- | ---: | --- |
| Traditional | Playwright | 0 | Script completed search and a sort-select action, but final observed page did not show accepted sorted navigation; diagnostic adapter failure, not a general Traditional capability estimate |
| Pure visual / Qwen 3.8 Max | AgentLab | 0 | 24 actions; initial search input missed focus, then repeated clicks around search area |
| Pure visual / Qwen 3.8 Flash | AgentLab | 0 | 24 repeated clicks on search input, without issuing a type action |
| Hybrid / Qwen 3.8 Max | AgentLab | **1** | 8 actions; search, price sort and ascending direction reached; native evaluator accepted |
| Hybrid / Qwen 3.8 Flash | AgentLab | 0 | 24 repeated search-input clicks, without issuing a type action |
| Hybrid / Qwen 3.8 Max | restricted Browser Use | 0 | 24 repeated search-input clicks; model prose proposed typing but raw action JSON remained click-only |
| Hybrid / Qwen 3.8 Flash | restricted Browser Use | 0 | Search results reached, then repeated sorting-control attempts until 24-action budget exhausted |

There was one additional **unscored engineering attempt**: Browser Use Max
was initially launched with the AgentLab Python executable. It reset and
cleaned its fixture, but failed before actor start with `PackageNotFoundError`
for `browser-use`. The attempt is retained with `official_score: null`, and
the correctly configured attempt uses a new output directory and port. A new
framework-package preflight and two offline regression tests now reject this
interpreter mismatch before the expensive reset. It is not counted as model
failure or silently overwritten.

The seven scored attempts constitute **one task and one diagnostic repetition
per configuration**, not seven independent benchmark tasks. In particular,
the Max AgentLab Hybrid success is evidence that the end-to-end evaluator can
accept a genuine result under this setup; it does not establish a Hybrid
population-level advantage. The Traditional initial script was generated from
the public task only. After observing agent trajectories, no Traditional
repair is performed, preserving a visible boundary against solution leakage.
Its score remains 0 in deployment-effectiveness accounting, with adaptation
quality marked as a threat to capability interpretation.

The companion JSON is a sanitized manifest of report/configuration digests,
task/arm/model, scores, terminal states, actions, reset durations and
eligibility. Raw screenshots, model prompts/responses, network HAR, native
evaluator internals and credentials remain in ignored local evidence stores.
This task still lacks full mutable-state isolation proof and independent,
outcome-blind Traditional authoring. It cannot unlock the 100-task bulk gate.
