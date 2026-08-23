# Phase 2 provider-grounding diagnosis (2026-08-23)

## Controlled evidence

All runs below used a fresh BookStack reset and an independent post-run oracle. Diagnostic outputs were written outside the repository ledger and contain no screenshots or credentials.

1. A real 1-repetition matched pilot completed Playwright and hybrid, while pure visual reached a page state accepted by the oracle but exited with an agent execution failure. The corrected cell gate therefore counted 2/3, not 3/3.
2. In the first pure-visual diagnostic, the provider returned a pointer with `x=1231,y=99`, outside the declared normalized 0..1000 contract. The harness rejected it rather than clipping it.
3. With an explicit pixel contract, the provider produced a mixed sequence and eventually returned `x=746,y=962`, outside the 1280×720 viewport. The harness again rejected it.
4. With the explicit `auto` compatibility mode, the provider repeatedly proposed the same `x=756,y=45` click. The new non-progress guard stopped after one executed click and reported `repeated non-progressing click`; it no longer burns the whole step budget on duplicate actions.

These are agent grounding/planning failures. They are not reset failures, oracle leakage, or evidence of a successful pure-visual cell.

## Code changes

- Pointer parsing now enforces integer coordinate bounds and reports the received values.
- Drivers support declared `normalized_1000`, `pixels`, and `auto` coordinate modes. `auto` treats coordinates inside the viewport as pixels and converts only values that exceed pixel bounds but remain in normalized bounds.
- The model-facing action history remains in the declared coordinate system; viewport conversion happens only at execution.
- Repeated non-progressing clicks are rejected and retried with an explicit provider instruction. They are never silently executed or clipped.
- The matched-pilot summary distinguishes `oracle_passed`, `agent_completed`, and `cell_passed`; an oracle pass with a failed agent process cannot satisfy admission.

## Verification

- Contract suite: 35/35 passed.
- Manifest and benchmark-matrix validators pass.
- The pure-visual admission gate remains closed. No repetition freeze, power simulation, fault/evolution expansion, or confirmatory collection was started.

## Next bounded action

The next model/provider intervention should be pre-registered as an arm configuration (for example, a visual coordinate-grid or a second multimodal model), then evaluated on the same one-cell pilot. It must not be mixed into the current Qwen arm as an undocumented prompt tweak.
