# Indico and Juice Shop clean matched pilot block — 2026-09-13

Evidence boundary: clean-stable T1 pilot/admission evidence only. This block
does not cover seeded faults or behavior-preserving UI evolution, does not admit
either application, and does not authorize power or confirmatory collection.

## Design and audit

- Applications/workflows: Indico `create-event` and Juice Shop
  `product-search`.
- Provider strata: Qwen3.7-Flash and DeepSeek V4.1-Flash vision.
- Arms: Playwright accessibility-locator, pure visual, and hybrid.
- Repetitions: three per provider/workflow/arm, with a fresh reset and clean
  independent oracle before every arm.
- Total: 36 records, 36 unique run IDs, four append-only ledgers. Every ledger
  passed the auditor with no duplicate IDs or malformed records.

## Outcomes

| Application/workflow | Provider/model | Playwright | Pure visual | Hybrid | Failure boundary |
|---|---|---:|---:|---:|---|
| Indico/create-event | Qwen3.7-Flash | 3/3 | 0/3 | 0/3 | visual grounding-loop; hybrid provider-format |
| Indico/create-event | DeepSeek V4.1-Flash | 3/3 | 0/3 | 0/3 | visual grounding-loop; hybrid provider-format/grounding-loop |
| Juice Shop/product-search | Qwen3.7-Flash | 3/3 | 0/3 | 0/3 | visual grounding-loop/agent-step-budget; hybrid provider-format |
| Juice Shop/product-search | DeepSeek V4.1-Flash | 3/3 | 0/3 | 0/3 | visual grounding-loop/agent-step-budget; hybrid provider-format |

All reset digests and clean-state oracles passed. The agent failures therefore
are not reset or clean-oracle contamination in this block. They are still
conditional pilot observations: only one workflow per application was tested,
and the fault/evolution conditions remain unimplemented for these runners.

## Interpretation and next action

The current evidence identifies an application/task boundary for the present
agent adapters, not a universal impossibility result for CUA or hybrid agents.
The immediate engineering branch is to preserve the provider-format traces,
then repair or explicitly freeze the action-output contract before rerunning a
bounded ablation. After that, each application still needs independent fault
positive/negative and evolution-invariant gates before admission can be
considered.

Standard metrics are in
`results/phase2/2026-09-13-indico-juice-longrun-clean-metrics-summary.json`.
They keep provider and model in the grouping key and are descriptive pilot
outputs only.

Raw ledgers remain under ignored local artifacts:

```text
artifacts/phase2/indico-three-arm-aliyun-qwen3.7-flash-phase2-longrun-indico-clean-qwen-20260913-records.jsonl
artifacts/phase2/indico-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-longrun-indico-clean-deepseek-20260913-records.jsonl
artifacts/phase2/juice-shop-three-arm-aliyun-qwen3.7-flash-phase2-longrun-juice-clean-qwen-20260913-records.jsonl
artifacts/phase2/juice-shop-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-longrun-juice-clean-deepseek-20260913-records.jsonl
```
