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
- Repetitions: one fresh reset per arm in each provider/condition block;
  arm order was randomized by the runner.
- The six append-only ledgers each passed the ledger auditor with three unique
  run IDs and no duplicate or malformed record.

## Outcomes

| Provider/model | Condition | Playwright | Pure visual | Hybrid | Boundary notes |
|---|---|---:|---:|---:|---|
| Qwen3.7-Flash | clean-stable | 1/1 | 1/1 | 1/1 | none |
| Qwen3.7-Flash | functional-fault | 1/1 | 0/1 | 1/1 | visual exhausted the agent step budget; provider response was available, but no fault verdict was emitted |
| Qwen3.7-Flash | UI evolution | 1/1 | 1/1 | 1/1 | none |
| DeepSeek V4.1-Flash | clean-stable | 1/1 | 1/1 | 1/1 | none |
| DeepSeek V4.1-Flash | functional-fault | 1/1 | 1/1 | 1/1 | none |
| DeepSeek V4.1-Flash | UI evolution | 1/1 | 1/1 | 1/1 | none |

The strict pass denominator is the independent oracle plus protocol-completion
contract. The Qwen visual fault run is retained as a false-negative/termination
boundary, not converted to an oracle success. Provider, model, arm, workflow,
and condition strata remain separate.

## Interpretation and next action

This block strengthens the conditional picture: both agents are currently
capable on this clean/evolution task under these two providers, while fault
grounding/termination is model-dependent in this repetition. One repetition
per cell is not sufficient for a variance or power freeze. The next action is
to repeat the same matched block under the pre-specified pilot repetition
window, then complete the remaining PrestaShop workflow slots before any
application admission decision.

Raw ledgers (kept under ignored local artifacts) are:

```text
artifacts/phase2/run-records/2026-09-13-aliyun-qwen3.7-flash-prestashop-clean-stable-canary-phase2-longrun-prestashop-clean-20260913-aligned.jsonl
artifacts/phase2/run-records/2026-09-13-aliyun-qwen3.7-flash-prestashop-functional-fault-canary-phase2-longrun-prestashop-fault-20260913-aligned.jsonl
artifacts/phase2/run-records/2026-09-13-aliyun-qwen3.7-flash-prestashop-ui-evolution-canary-phase2-longrun-prestashop-evolution-20260913-aligned.jsonl
artifacts/phase2/run-records/2026-09-13-deepseek-deepseek-v4-flash-vision-exp-prestashop-clean-stable-canary-phase2-longrun-prestashop-clean-20260913-aligned.jsonl
artifacts/phase2/run-records/2026-09-13-deepseek-deepseek-v4-flash-vision-exp-prestashop-functional-fault-canary-phase2-longrun-prestashop-fault-20260913-aligned.jsonl
artifacts/phase2/run-records/2026-09-13-deepseek-deepseek-v4-flash-vision-exp-prestashop-ui-evolution-canary-phase2-longrun-prestashop-evolution-20260913-aligned.jsonl
```
