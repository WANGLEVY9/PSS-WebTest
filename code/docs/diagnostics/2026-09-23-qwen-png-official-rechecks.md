# Lossless-PNG official WAV rechecks (diagnostic only)

The existing official WebArena-Verified tasks were rerun **after** the pixel
transport change, using a new owned Shopping fixture per process, the pinned
native evaluator, a 24-action/180-second actor budget, replay audit and owned
cleanup. These are new diagnostic configurations, not replacements for earlier
attempts and not confirmatory repetitions. The private screenshot/HAR/model
text/evaluator artifacts remain in ignored local evidence stores.

## Task 324 — Qwen 3.8 Flash / AgentLab pure visual

- Prior public-intent task: show all chairs listings sorted by ascending price.
- New configuration SHA-256:
  `acb694bc462804e4b113967fc0337b6ef67897f709ee7891f14a799e30e5b204`.
  Report SHA-256:
  `1b65bed9362d417429d404386727f528c2229c29eaa76b9e82c924bb37250857`.
- Fresh reset completed (~182.25 s); 24 provider responses all had
  `finish_reason=stop` and no provider failure. The PNG capture contract had
  zero errors; 24 actions had zero browser action errors. Native assessment
  was valid, official score **0**, actor exhausted its 24-action budget,
  replay passed, and owned cleanup completed.
- Every accepted action was the **same click** at CSS `(1084.16,86.4)`. That
  point lies inside the visible search field in the saved 1280×720 frame.
  After focus, the model neither typed the query nor changed strategy. Only
  three distinct screenshot hashes occurred across 25 frames, consistent
  with focus/caret rendering rather than task navigation.

**Attribution:** this particular zero is not supported as a coordinate
decoder, PNG transport, provider, reset or evaluator failure. The direct
observed boundary is repeated model action selection without text entry.
The result does not establish a population-level model capability estimate.
The old task-324 Flash zero remains in the ledger; it is not overwritten.

## Task 351 — Qwen 3.8 Flash / AgentLab pure visual

- Prior public-intent task: show PS4 accessories products sorted by ascending
  price. New configuration SHA-256:
  `413d14cac3722c6bdc4c155c5de8298f60ecf810b3ed7374f2e0ff23e61cd75a`.
  Report SHA-256:
  `443a25c2414f1fbd01c14042fa01668bd23d6772be390360c108cecd26790831`.
- Fresh reset completed (~179.32 s). All 24 provider requests and actions
  completed without transport, capture-contract or browser action errors.
  Native assessment was valid, official score **0**, 24-action budget
  exhausted, replay passed and owned cleanup completed.
- Three initial clicks navigated/filter-selected within Video Games. The next
  **21 actions all clicked the same native `Sort By` select** at CSS
  `(1146.88,403.2)`. The post-click screenshot visibly showed the select
  focused with the value `Position`; it did not show its option panel. The
  screenshot hash stayed identical across subsequent repeated clicks.

**Attribution:** the intended control was visually grounded and the click
actuator reported success, so the zero is not explained by coordinate scaling
or request transport. The current page-screenshot interface did not expose
native popup options (also reproduced on a synthetic page), and the model did
not choose another declared action such as keyboard interaction. Record both
the **observation-interface limitation** and the **repeated-action policy**;
do not silently provide DOM `<option>` data to pure visual or label the entire
case as a general CUA incapability. The old task-351 Flash zero remains intact.

## What these two rechecks do and do not establish

The repaired PNG pathway is now validated against a real Qwen endpoint and
two official task lifecycles, but neither task's native score improved. The
paired configurations differ from older ones in transport and instruction
wording, so they are remediation diagnostics rather than a randomized causal
effect estimate of PNG alone. Neither full-state benchmark isolation nor
confirmatory campaign admission is claimed.
