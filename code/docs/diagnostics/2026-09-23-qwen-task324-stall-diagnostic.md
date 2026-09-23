# Official WAV task 324: pixel-only stall-feedback check

This is one additional **diagnostic** execution of official WebArena-Verified
task 324, using Qwen 3.8 Max, AgentLab pure visual, the compact action prompt,
and opt-in exact screenshot no-change feedback. It is not an independent new
task or a confirmatory repetition. The earlier task-324 outcomes remain
unchanged.

The fresh Shopping instance reset completed. The actor made 24 actions and
exhausted its action budget; the pinned native evaluator gave score 0. Replay
integrity, source-snapshot stability, native assessment and owned cleanup all
passed. There was no provider or engineering exception. The companion JSON
contains the sanitized report and configuration hashes.

The model repeated an eight-cycle sequence of click, type and Enter. A visual
audit showed the click was to the left of the visible search field. The
existing screenshots produced 23 exact no-change signals, and the model
received those signals through its pixel-only task projection. It did not
relocate the click target. This run gives stronger evidence of a visual
grounding/correction failure under this model and interface. It does not
support attributing the zero to reset, provider availability, action parser,
or the official evaluator.

Because both the compact prompt and optional screenshot signal differ from
the earlier task-324 execution, the result is a remediation diagnostic, not
an isolated causal estimate of the feedback feature. Raw screenshots, model
messages and evaluator-private records remain outside the public repository.
