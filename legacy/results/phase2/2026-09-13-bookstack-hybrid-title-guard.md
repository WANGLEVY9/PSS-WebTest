# BookStack Hybrid title-field guard diagnostic — 2026-09-13

Evidence boundary: one direct Hybrid diagnostic after the create-page gate;
not a confirmatory result.

The replay showed that Qwen could navigate to the editor but repeatedly clicked
the already-focused Page Title textbox instead of clearing its default value.
The runner now uses a declared focus guard: after a title textbox click, a
subsequent action must be `keypress CTRL+A` before typing. The guard is based on
the allow-listed page-structure interaction/name metadata and does not expose
the oracle or database state.

With `CUA_MAX_DECISION_RETRIES=3`, the provider returned the same `click
target_id=c11` four times. The guard stopped the run before an incorrect title
could be persisted and classified the boundary as `provider-format`. Reset,
authentication, page navigation, and the independent oracle were healthy; no
page candidate was created. This is evidence that the remaining failure is a
model/action-sequence limitation under the tested Qwen profile, not a reset or
oracle defect. It does not establish that all Hybrid agents fail this task.
