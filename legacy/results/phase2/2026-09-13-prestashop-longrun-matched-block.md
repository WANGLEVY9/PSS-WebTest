# PrestaShop long-run matched pilot block — 2026-09-13

Evidence boundary: this is a T1 admission/pilot block. It is not a
confirmatory estimate, does not freeze repetitions, and does not support a
global ranking.

## Design

- SUT: version-pinned local PrestaShop instance on `localhost:8083`.
- Provider strata: Alibaba-compatible Qwen3.7-Flash and DeepSeek V4.1-Flash
  vision profile. Doubao was not included because the readiness manifest marks
  its endpoint blocked by HTTP 429.
- Arms: accessibility-locator Playwright, pure visual, and hybrid visual plus
  declared page structure.
- Conditions: one clean baseline, one seeded visible-result omission fault,
  and one presentation-only search-layout evolution.
- Repetitions: three fresh repetitions per provider/condition/arm cell; the
  first repetition was collected in one campaign tag and repetitions two and
  three in a second tag. Each arm reset the SUT independently and arm order was
  randomized by the runner.
- The twelve append-only ledgers each passed the ledger auditor with unique
  run IDs and no duplicate or malformed record.

## Outcomes

| Provider/model | Condition | Playwright | Pure visual | Hybrid | Boundary notes |
|---|---|---:|---:|---:|---|
| Qwen3.7-Flash | clean-stable | 3/3 | 3/3 | 3/3 | none |
| Qwen3.7-Flash | functional-fault | 3/3 | 0/3 | 2/3 | visual failed all three repetitions at agent-step-budget; hybrid failed one repetition at the same boundary |
| Qwen3.7-Flash | UI evolution | 3/3 | 3/3 | 3/3 | none |
| DeepSeek V4.1-Flash | clean-stable | 3/3 | 3/3 | 3/3 | none |
| DeepSeek V4.1-Flash | functional-fault | 3/3 | 3/3 | 3/3 | none |
| DeepSeek V4.1-Flash | UI evolution | 3/3 | 3/3 | 3/3 | none |

Across the 54 executions, 50 were strict passes. The strict pass denominator
is the independent oracle plus protocol-completion contract. The Qwen visual
fault executions are retained as false-negative/termination boundaries, not
converted to oracle successes. Provider, model, arm, workflow, condition, and
repetition strata remain separate.

The standard metrics summary is generated with provider/model in the grouping
key (15 strata, rather than a pooled visual or hybrid estimate):
`results/phase2/2026-09-13-prestashop-longrun-metrics-summary.json`.
It is descriptive pilot output only; it does not estimate between-application
variance or freeze repetitions.

## Interpretation and next action

This block strengthens the conditional picture: both agents are currently
capable on the clean/evolution task under these two providers, while fault
grounding/termination is model-dependent and repeats for Qwen. Three
repetitions are still a pilot window, not a power freeze. The next action is
to complete the remaining PrestaShop workflow slots, then collect matched
pilot windows for those slots before any application admission decision.

Raw ledgers (kept under ignored local artifacts) are:

```text
artifacts/phase2/run-records/2026-09-13-aliyun-qwen3.7-flash-prestashop-clean-stable-canary-phase2-longrun-prestashop-clean-20260913-aligned.jsonl
artifacts/phase2/run-records/2026-09-13-aliyun-qwen3.7-flash-prestashop-clean-stable-canary-phase2-longrun-prestashop-clean-r2-3-20260913-aligned.jsonl
artifacts/phase2/run-records/2026-09-13-aliyun-qwen3.7-flash-prestashop-functional-fault-canary-phase2-longrun-prestashop-fault-20260913-aligned.jsonl
artifacts/phase2/run-records/2026-09-13-aliyun-qwen3.7-flash-prestashop-functional-fault-canary-phase2-longrun-prestashop-fault-r2-3-20260913-aligned.jsonl
artifacts/phase2/run-records/2026-09-13-aliyun-qwen3.7-flash-prestashop-ui-evolution-canary-phase2-longrun-prestashop-evolution-20260913-aligned.jsonl
artifacts/phase2/run-records/2026-09-13-aliyun-qwen3.7-flash-prestashop-ui-evolution-canary-phase2-longrun-prestashop-evolution-r2-3-20260913-aligned.jsonl
artifacts/phase2/run-records/2026-09-13-deepseek-deepseek-v4-flash-vision-exp-prestashop-clean-stable-canary-phase2-longrun-prestashop-clean-20260913-aligned.jsonl
artifacts/phase2/run-records/2026-09-13-deepseek-deepseek-v4-flash-vision-exp-prestashop-clean-stable-canary-phase2-longrun-prestashop-clean-r2-3-20260913-aligned.jsonl
artifacts/phase2/run-records/2026-09-13-deepseek-deepseek-v4-flash-vision-exp-prestashop-functional-fault-canary-phase2-longrun-prestashop-fault-20260913-aligned.jsonl
artifacts/phase2/run-records/2026-09-13-deepseek-deepseek-v4-flash-vision-exp-prestashop-functional-fault-canary-phase2-longrun-prestashop-fault-r2-3-20260913-aligned.jsonl
artifacts/phase2/run-records/2026-09-13-deepseek-deepseek-v4-flash-vision-exp-prestashop-ui-evolution-canary-phase2-longrun-prestashop-evolution-20260913-aligned.jsonl
artifacts/phase2/run-records/2026-09-13-deepseek-deepseek-v4-flash-vision-exp-prestashop-ui-evolution-canary-phase2-longrun-prestashop-evolution-r2-3-20260913-aligned.jsonl
```
