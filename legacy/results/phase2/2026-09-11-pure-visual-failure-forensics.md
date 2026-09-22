# Pure Visual failure forensics — PrestaShop matched pilot

Date: 2026-09-11  
Status: diagnostic analysis; no confirmatory claim.

## Question

The aligned pilot table shows Pure Visual `0/15`. This report checks whether that is evidence that screenshot-only CUA cannot perform the task, or whether the failures are caused by the provider protocol, runner configuration, model grounding, or the SUT.

## What the 15 failures actually contain

The 15 records are five Qwen, five DeepSeek, and five Doubao runs across clean, UI-evolution, and functional-fault conditions. All were reset-isolated; the independent database oracle found the expected product rows. None reached the visible search-results checkpoint.

| Provider/model | Count | Observed boundary | Evidence interpretation |
|---|---:|---|---|
| Alibaba Qwen3.7-Flash | 5 | 2 `agent-step-budget`, 3 `grounding-loop` | The current aligned runs inherited `CUA_ALIYUN_ACTION_MODE=json`; HTTP 200 textual JSON responses repeatedly selected the search-box click and did not progress to typing. This is a protocol/profile confound plus visual grounding sensitivity, not a provider outage. |
| DeepSeek V4 vision | 5 | 5 `grounding-loop` | Tool calls were valid and HTTP responses were healthy, but the model repeatedly clicked the same visible search control and did not issue the next type action. This is the strongest current evidence of a model/arm grounding and focus-tracking limitation, but it is still one workflow. |
| Doubao Seed 2.1 Pro | 5 | 5 `provider-format` | Responses API returned HTTP 200 with `finish_reason=incomplete`, no tool call, and no valid JSON. This is an API/action-mode/output-budget boundary, not evidence that the visual model cannot understand the screenshot. |

## Counterevidence against an inherent CUA impossibility claim

1. Historical PrestaShop exploratory visual batches using the same screenshot-only arm and Qwen model produced 256 strict completed records out of 500 (118/200 simple, 116/175 medium, 22/125 complex). Those batches are diagnostic and not matched/confirmatory, but they prove the arm is not categorically incapable.
2. Historical successful Qwen traces use `ui_action` tool calls and contain the sequence `click → type → keypress`; the current aligned Qwen JSON traces contain repeated clicks or step-budget exhaustion. The initial screenshot digest is identical, so this is not explained by a different SUT page.
3. A fresh Doubao diagnostic with `CUA_VOLCENGINE_API_MODE=chat`, tool calls, and `CUA_MAX_OUTPUT_TOKENS=1024` completed the same clean Pure Visual workflow once (`click → type → keypress`, independent oracle passed). This directly demonstrates that the previous Doubao failure was not an unconditional visual incapability.
4. In the same aligned SUT/workflow, Hybrid completed 6/6 Qwen/DeepSeek clean/evolution runs while their Pure Visual counterparts failed. This is evidence that visible structure and candidate grounding can help; it is not evidence that Pure Visual is impossible.

## What is and is not ruled out

### Ruled out as the primary explanation

- SUT reset failure: reset completed and the SUT served the expected authenticated page.
- Database/oracle corruption: the independent product query passed in the failed runs.
- Browser launch failure or provider connectivity outage: all three providers returned HTTP responses; Playwright completed the same task.
- A universal Pure Visual impossibility claim: historical Qwen success and the corrected Doubao diagnostic contradict it.

### Still plausible and separable

- Provider/action protocol mismatch: Qwen textual JSON and Doubao Responses settings are not equivalent to the tool-call configurations used in successful traces.
- Coordinate grounding: the Qwen tool diagnostic selected a point just outside the search input in one run; a pixel/normalization switch did not help and itself produced different coordinates. This must be tested as a declared coordinate-protocol ablation, not silently repaired with DOM selectors.
- Model-level focus tracking: DeepSeek repeatedly selected a valid-looking search-box coordinate without transitioning to a type action.
- Pure-visual arm limitation: without page structure or target IDs, a small coordinate error and failure to infer focus are harder to recover from than in Hybrid.
- Run-to-run provider variance: tool-call and JSON outputs differ across runs even with temperature zero; the matched pilot must record the exact action mode and profile.

## Decision

The correct current conclusion is **not** “CUA cannot do Web UI testing.” The evidence supports a layered finding:

1. The reported `0/15` is not a clean estimate of Pure Visual capability because it mixes a Qwen action-mode confound and a Doubao Responses truncation boundary with genuine DeepSeek grounding failures.
2. After protocol repair, DeepSeek-like repeated-click failures may remain as a real screenshot-only grounding limitation on this task; that is a testable capability result, not yet a general conclusion.
3. The primary matched pilot must be rerun only after freezing one validated provider profile per model. The previous 0/15 block remains immutable diagnostic evidence and must not be overwritten.

## Required next experiments

1. Add a provider-readiness gate that requires one screenshot-only `click → type → keypress` conformance trace before an arm enters a matched cell.
2. Re-run Qwen with the tool-call profile used by the historical successful traces; keep textual JSON as a separately labelled protocol ablation.
3. Re-run Doubao with the validated Chat Completions/tool-call/high-budget profile; keep Responses mode as a separate provider-protocol stratum.
4. Run DeepSeek with the same task and prompt under tool and JSON modes, then add a pre-registered screenshot-only coordinate-robustness ablation without DOM access.
5. Only after clean and seeded-fault positive controls pass for each provider should the three-arm admission pilot be repeated or any repetition count/power calculation be considered.
