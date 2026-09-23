# Pixel-capture and native-select engineering audit

Scope: engineering diagnosis only. The checks below use a synthetic 1280×720
Chromium page and no model, benchmark task, reset, or evaluator. Earlier WAV
task 324/351 results remain unchanged; this patch is a **new diagnostic
configuration**, not a retrospective repair or confirmatory result.

## What was checked

1. The frozen context uses 1280×720 CSS viewport and device-scale factor 1.
   A normalized point `(828,125)` decodes to `(1059.84,90)` CSS pixels and
   activates a synthetic button at x=940–1180, y=70–110. The Playwright mouse
   actuator therefore uses the same axes as the screenshot in this test. This
   does **not** prove that Qwen chose the correct point in WAV task 324.
2. AgentLab upstream `Observation.add_screenshot` converted the PNG frame to
   JPEG. The local boundary now uses a lossless PNG **without resizing** for
   AgentLab. A test decodes the actual prompt image and confirms 1280×720 and
   an exact test pixel. Browser Use already transmitted PNG. This is a
   transport-fidelity fix, not evidence of improved model capability.
3. Every actor screenshot now requests a viewport-only, CSS-scale PNG and
   checks its dimensions before the frame can enter the model prompt. A
   mismatch fails closed as `CaptureContractError` and is journaled as a
   private `observation-error`; it is not counted as a model failure.
4. On the pinned local headless Chromium, opening a synthetic native `<select>`
   altered captured pixels only in the focused controls' bounds; no dropdown
   option panel appeared below the select in `page.screenshot`. `ArrowDown`
   then `Enter` did not change its value in this environment. A typed `p`
   then `Enter` did change the value to `Price low`, showing the keyboard
   actuator can interact with that control, but **not** that the target option
   is generally knowable from a screenshot. Prompt text no longer claims
   Arrow keys will reliably change a native select.
5. A post-change live Qwen Flash synthetic smoke **did not reach the API**:
   the checkout's default shared spend-policy JSON differs from the already
   populated durable spend ledger and has no admitted model rates. The first
   smoke had been reported as `provider-bridge-configuration` after allocating
   an unresolved local reservation; this is a policy/configuration failure,
   not a Qwen/image-transport result. The smoke entry point now checks the
   policy **before** creating its output directory or request ledger. A second
   invocation rejected at preflight with no task allocation. Do not erase or
   replace the historical ledger to make this test pass; use an approved,
   versioned tariff-policy migration with audit evidence before any live run.

## Attribution and boundary

- A wrong click coordinate on an otherwise faithful screenshot, followed by
  repeated unchanged-frame feedback, remains a **model grounding/correction
  candidate**, not automatically an engineering failure. The WAV 324 visual
  trajectory still needs any model-capability conclusion to be scoped to its
  actual image and configuration.
- The invisible native menu is a **page-screenshot observation limitation**.
  We will not reveal `<option>` text from DOM/accessibility to pure visual,
  select by locator on its behalf, inject an overlay into the SUT, or infer
  the correct sort option from the evaluator. Such changes would alter the
  treatment or leak structured information. The limitation should be coded
  separately from provider timeout, parser failure, and wrong visible click.
- Headed OS-level capture is a possible *future separately preregistered
  observation treatment*, but is not established as equivalent to the current
  headless page screenshot and must not silently replace it.
- The lossless PNG path passed an offline prompt-decoding test. A paid model
  request with the repaired path has **not** yet passed the shared spend gate;
  no claim of end-to-end provider acceptance or task-score improvement follows.

## Reproduce locally

From `code/experiment`, run the pinned AgentLab Python interpreter:

```sh
../../third_party/frameworks/h-agentlab/bin/python -m unittest -v \
  test_visual_capture_contract test_runtime_actions test_runtime_actor_lifecycle
```

The test prints platform-specific native-select behavior instead of asserting
that all Chromium/OS versions render the popup identically. It deliberately
uses DOM reads only in supervisor assertions, never in an actor observation.
