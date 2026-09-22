# BookStack DeepSeek Hybrid title-recovery ablation

Date: 2026-09-13  
Status: pilot/diagnostic only; not an admission or confirmatory result.

## Question

The baseline DeepSeek Hybrid create-page pilot reached the editor but repeatedly
selected the title textbox after the harness rejected appending to BookStack's
default title. This ablation tests whether an explicit retry instruction can
recover the missing `CTRL+A` action without injecting that action or using any
hidden oracle state.

## Change and provenance

- Arm: Hybrid, screenshot plus allow-listed page structure.
- Provider/model: DeepSeek API / `deepseek-v4-flash-vision-exp`.
- Change: when the harness rejects an action with `title-clear`, append a
  bounded instruction requiring the next provider action to be exactly
  `keypress CTRL+A`.
- No automatic keypress, selector, title text, oracle result, or fallback was
  injected by the harness.
- Configuration: `hybrid-pss-native-deepseek-title-recovery-v1`.
- Prompt policy digest:
  `3c41545238b9bb915bbfae0f44abb9d1122eb5b5d43c5384a60076dc88d7cfc6`.
- Baseline visual and Playwright arms retain their ordinary configuration IDs.

## Matched clean pilot

One reset and one execution per arm were scheduled. All resets and the
pre-execution independent oracle checks passed.

| Arm | Result | Boundary |
|---|---:|---|
| Hybrid title-recovery | 0/1 | provider-format: `title textbox requires CTRL+A`; the model still did not emit the required keypress within the retry budget |
| Playwright | 1/1 | independent persisted-state oracle passed |
| Pure visual | 0/1 | grounding-loop: repeated non-progressing coordinate click |

The artifact contains three records and no manually inserted result:
`code/artifacts/phase2/bookstack-create-page-clean-stable-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-bookstack-deepseek-create-clean-title-recovery-v1-pilot.json`.

## Interpretation

The guard itself is not the cause of the Hybrid failure: it correctly prevented
an unsafe append to the default title, and the independent oracle remained
unknown because no page was persisted. The retry-prompt-only optimization did
not recover this one-cell run. This is evidence of a remaining provider/action
grounding boundary, not evidence that Hybrid is universally incapable. It also
does not authorize increasing repetitions or entering confirmatory collection.

Next diagnostic options are to compare a semantic target-id/tool-call action
schema and a separately registered framework adapter, or to park this
workflow while preserving the failure boundary. Any such change must receive
its own configuration ID and pilot stratum.
