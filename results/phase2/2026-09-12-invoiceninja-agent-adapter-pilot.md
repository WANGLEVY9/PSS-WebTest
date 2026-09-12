# Invoice Ninja agent-adapter pilot — 2026-09-12

Evidence boundary: this is a diagnostic clean-stable pilot. It is **not** a
confirmatory result and does not admit Invoice Ninja to the confirmatory
population. All raw screenshots and replay manifests remain in the ignored
`artifacts/phase2/replays/` directory; the JSONL run records are local-only.

## Scope

- SUT: Invoice Ninja `5.11.61` local compose deployment.
- Task: `invoiceninja-view-invoice-details` — from an authenticated dashboard,
  open **Invoices**, then open the exact seeded invoice `123456`.
- Oracle: independent persisted-state database oracle requiring one exact row
  (`status_id=4`, `amount=120000`, `balance=0`). The oracle is never sent to an
  arm and is evaluated after the arm stops.
- Arms: Pure visual screenshot-only and Hybrid screenshot + allow-listed page
  structure. Playwright is the existing reference cell.
- Model strata exercised: Alibaba Qwen3.7-VL-Flash and DeepSeek V4.1-Flash.

## Engineering changes in this round

1. Added `code/scripts/run-invoiceninja-agent-cell.mjs` for both agent arms.
2. Added `pilot:invoiceninja:visual` and `pilot:invoiceninja:hybrid` npm
   scripts.
3. Added a matched post-login preamble that dismisses Invoice Ninja's first-use
   company dialog before the first agent observation. This removes the earlier
   Hybrid-only actionability timeout caused by a modal overlay.
4. Hybrid candidate IDs are now attached to the actual visible DOM controls;
   text-based fuzzy matching is no longer used for execution.
5. Free-form model completion text is normalized to `unknown` and classified as
   `termination-verdict`; it cannot be counted as a strict pass.

## Runs after the preamble/target-binding fix

| Run | Arm | Model | State reached | Independent oracle | Strict cell | First boundary |
|---|---|---|---:|---:|---:|---|
| `invoiceninja-visual-deepseek-clean-r2` | Pure visual | DeepSeek V4.1-Flash | yes | pass | no | `termination-verdict` |
| `invoiceninja-hybrid-deepseek-clean-r3` | Hybrid | DeepSeek V4.1-Flash | yes | pass | no | `termination-verdict` |
| `invoiceninja-hybrid-qwen-clean-r2` | Hybrid | Qwen3.7-VL-Flash | yes | pass | no | `termination-verdict` |

The three agent runs all navigated to `/invoices/VolejRejNm/edit` and passed the
independent database oracle. Each provider returned a natural-language
completion description rather than the required exact `done/pass` protocol;
strict admission therefore correctly remains false. This is evidence of a
termination-protocol boundary, not an oracle or SUT failure.

## Runs before the fix (retained as engineering diagnostics)

| Run | Arm | Model | Boundary | Interpretation |
|---|---|---|---|---|
| `invoiceninja-visual-qwen-clean-r1/r2` | Pure visual | Qwen3.7-VL-Flash | `provider-format` after reaching `/clients` or `/invoices` | Qwen tool arguments were not parseable at the next navigation step |
| `invoiceninja-hybrid-qwen-clean-r1` | Hybrid | Qwen3.7-VL-Flash | Playwright actionability timeout | first-use modal overlay was not dismissed |
| `invoiceninja-hybrid-deepseek-clean-r1/r2` | Hybrid | DeepSeek V4.1-Flash | Playwright actionability timeout | same preamble/modal issue; fixed in `r3` |

These records are not pooled with the post-fix runs.

## Admission status

Invoice Ninja remains **not admitted** because the following gates are still
open:

- only one clean diagnostic repetition per post-fix arm/model;
- no functional-fault or behavior-preserving-evolution mutation workflow;
- application image is not digest-pinned (`version_pin=null`);
- strict termination protocol has not yet been stabilized or preregistered as
  a model/framework stratum;
- Playwright has a passing reference cell, but the complete three-arm matched
  pilot has not been repeated at the required pilot count.

## Next controlled iteration

1. Keep the strict `done/pass` rule and collect termination-verdict frequency;
   do not silently coerce natural-language completion into success.
2. Freeze the Invoice Ninja image/reset digest and add one isolated fault plus
   one behavior-preserving evolution mutation.
3. Repeat the same task with randomized arm order and independent reset.
4. Only after three-arm clean/fault/evolution evidence is complete, reconsider
   application admission and include Invoice Ninja in pilot variance estimates.
