# Juice Shop pagination last-item pilot (2026-09-13)

Status: diagnostic pilot only; no application admission, variance freeze, or
confirmatory inference.

## Scope

This tranche evaluates a second pagination workflow separately from the earlier
`juice-shop-pagination` / Lemon Juice task. The target is **OWASP Juice Shop
Sticker Page**, which is visible in the seeded catalog after moving to the
`16–30 of 46` page without requiring the agent to scroll back to the top. The
separation is intentional: the earlier Lemon Juice task exposed a target that
was above the post-pagination viewport, so an agent could reach the correct
page while being unable to satisfy a screenshot-only visibility condition.

The same browser-scoped omission mutation, behavior-preserving layout
evolution, independent visible-state oracle, append-only run-record ledger, and
three-arm matched controller were used for every block. Playwright was run
without a provider. Qwen and DeepSeek were kept as separate model strata.

## Executed blocks

| Provider/model | Condition | Playwright | Hybrid | Pure visual | Strict block |
|---|---|---:|---:|---:|---:|
| Alibaba / Qwen3.7-Flash | clean-stable | 1/1 | 0/1 grounding-loop | 0/1 provider-format | 1/3 |
| Alibaba / Qwen3.7-Flash | functional-fault | 1/1 | 0/1 grounding-loop | 0/1 agent-step-budget | 1/3 |
| Alibaba / Qwen3.7-Flash | ui-evolution | 1/1 | 0/1 grounding-loop | 0/1 provider-format | 1/3 |
| DeepSeek / V4.1-Flash | clean-stable | 1/1 | 1/1 | 0/1 grounding-loop | 2/3 |
| DeepSeek / V4.1-Flash | functional-fault | 1/1 | 0/1 grounding-loop | 0/1 grounding-loop | 1/3 |
| DeepSeek / V4.1-Flash | ui-evolution | 1/1 | 1/1 | 0/1 grounding-loop | 2/3 |

Total: **18 valid reset-verified executions**, of which Playwright passed 6/6,
Hybrid passed 2/6, and Pure visual passed 0/6. These are one-repetition
provider-stratified pilot observations, not estimates of stable success rates.

The first Qwen clean attempt (`pagination-last-item-qwen-r1b`) contained one
reset-failed Hybrid record and is excluded from the table; it is retained as
infrastructure evidence. The replacement block (`pagination-last-item-qwen-clean-r2`)
had a valid reset for all three arms. No record is upgraded because of this
rerun.

## Interpretation boundary

The corrected target placement removes one known task-design confound: after
the page transition, the target is available in the current viewport and in
the Hybrid landmark set. The remaining failures therefore provide diagnostic
evidence about provider formatting, visual grounding/termination, and semantic
replanning. They do **not** prove that either agent family cannot perform
pagination in general. DeepSeek Hybrid's two strict passes show that the same
workflow is executable under at least one model/condition stratum; Qwen Hybrid's
repeated grounding-loop is a model-stratum failure boundary, not a Playwright
or oracle failure.

The earlier Lemon Juice pagination block must remain separately reported. Its
post-transition offscreen target is a negative task-design diagnostic, not a
pooled capability estimate.

## Reproducibility artifacts

Tracked configuration and code:

- `code/config/juice-shop-pagination-last-item-run-manifest.v0.1.json`
- `code/tests/traditional/juice-shop-pagination-last-item.spec.js`
- `code/src/mutations/juice-shop-pagination.mjs`
- `code/src/oracles/juice-shop-pagination.mjs`
- `code/scripts/evaluate-juice-shop-pagination.mjs`
- `code/scripts/juice-shop-matched-pilot.mjs`

Raw replay JSON, screenshots, and JSONL records remain local under
`artifacts/phase2/` and are ignored by Git. The six controller summaries used
for this report are:

- `juice-shop-three-arm-aliyun-qwen3.7-flash-pagination-last-item-qwen-clean-r2-clean-stable-pilot.json`
- `juice-shop-three-arm-aliyun-qwen3.7-flash-pagination-last-item-qwen-fault-r1-functional-fault-pilot.json`
- `juice-shop-three-arm-aliyun-qwen3.7-flash-pagination-last-item-qwen-evolution-r1-ui-evolution-pilot.json`
- `juice-shop-three-arm-deepseek-deepseek-v4-flash-vision-exp-pagination-last-item-deepseek-clean-r1-clean-stable-pilot.json`
- `juice-shop-three-arm-deepseek-deepseek-v4-flash-vision-exp-pagination-last-item-deepseek-fault-r1-functional-fault-pilot.json`
- `juice-shop-three-arm-deepseek-deepseek-v4-flash-vision-exp-pagination-last-item-deepseek-evolution-r1-ui-evolution-pilot.json`

The three-condition Playwright gate passed before agent execution. Contract and
manifest validation after this tranche: **199/199 contract tests**, 3
applications / 10 task manifests, and long-run arithmetic unchanged at 2,160
matched cells / 30,240 executions.
