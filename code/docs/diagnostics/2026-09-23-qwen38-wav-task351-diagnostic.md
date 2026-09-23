# Official WAV task 351: PS4-accessories sort diagnostic

Status: **diagnostic only**. Task 351 was selected in the frozen WAV 100-task
development list. It combines category navigation and price-ascending sort.
The intended matrix has seven configurations. Ten process attempts were made
because Qwen Max pure visual had two provider-timeout retries and one
unscored engineering attempt; these are **not** ten independent tasks or
repetitions. Every process used a new owned Shopping fixture and output path.

| Configuration | Native score | Terminal / failure | Audited boundary |
| --- | ---: | --- | --- |
| Traditional Playwright | 0 | `execution-error / TimeoutError` | Public-intent-only script could not locate its first PS4-accessories link; retained as deployment/adaptation failure |
| Max AgentLab pure visual, 30 s attempt 1 | 0 | `provider-error / provider-timeout` | Fifth API request hit 30 s transport bound after four accepted actions |
| Max AgentLab pure visual, 30 s attempt 2 | 0 | `provider-error / provider-timeout` | Sixteenth API request hit the same bound after 15 accepted actions |
| Max AgentLab pure visual, 45 s attempt 1 | **null** | pre-actor `ValueError` | Newly added timeout field was rejected by strict actor-payload allowlist; engineering attempt retained, no model inference |
| Max AgentLab pure visual, 45 s attempt 2 | 0 | `provider-error / provider-output-incomplete` | Twelfth request took about 44.4 s and hit the 2,048-output-token cap (`finish_reason=length`) |
| Flash AgentLab pure visual | 0 | 24-action budget | Reached PS4 accessories-related filtering, then repeated sort-control clicks |
| Max AgentLab Hybrid | 0 | actor `completed` | Reached price-ascending search results for PS4 accessories, but native navigation-event oracle did not accept this route |
| Flash AgentLab Hybrid | 0 | 24-action budget | Reached relevant category filtering, then repeated sort-control clicks |
| Max restricted Browser Use Hybrid | 0 | 24-action budget | Reached accessories area, then repeated sort-control clicks |
| Flash restricted Browser Use Hybrid | 0 | `invalid-model-action` | Reached PlayStation 4 filtering; ninth raw model action was `[]`, not the required action object |

Nine attempts completed actor termination, native evaluation, replay audit and
owned cleanup; the other failed before actor start and has no score. Five
attempts meet the conservative diagnostic analysis rule. The Traditional
script execution failure remains visible in deployment-effectiveness
accounting; it is not recoded as intrinsic Playwright inability. All three
Max pure-visual scored attempts encountered transport/output problems, so
they provide no clean task-capability verdict. No favorable retry replaced an
earlier failure.

The 45-second request cap is an explicitly recorded **new diagnostic
configuration**; the baseline 30-second cap remains unchanged. An initial
implementation omitted this operational field from the actor payload
allowlist. The strict boundary rejected it; the fix only permits a bounded
1–45-second timeout, not page structure, evaluator data or extra model
observations. Fourteen Chromium lifecycle regression tests passed after the
fix. The later 45-second model attempt shows that timeout adjustment alone
does not resolve output truncation; we do not silently increase output tokens
or pool the variants.

The native 0 for Max Hybrid is preserved. Reaching a semantically related
search page is not equivalent to the benchmark's required navigation event.
This is a testing-correctness/construct-validity observation, not grounds to
change the official oracle or leak its internals to any arm. Traditional
authoring preceded this audit and was not repaired from agent trajectories.

The companion JSON contains only sanitized report/configuration digests,
task/arm/model, score, failure class, actions, reset and actor durations,
request-timeout variant and eligibility. Raw screenshots, provider text,
network HAR, credentials and evaluator internals remain in ignored private
evidence. Full mutable-state isolation and outcome-blind Traditional authoring
remain open; task 351 does not authorize the 100-task bulk campaign.
