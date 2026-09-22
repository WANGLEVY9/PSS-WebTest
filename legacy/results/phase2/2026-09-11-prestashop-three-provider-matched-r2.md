# PrestaShop three-provider matched pilot, repetition 2

Date: 2026-09-11  
Evidence boundary: two exploratory clean-stable repetitions now exist; this is still pilot evidence and is not confirmatory.

## Protocol and ledger gate

The SUT was reset and re-seeded before this repetition. The benchmark task ID
is `prestashop-buyer-search-product` for all three runners. The three provider
strata each contributed visual, hybrid, and Playwright records to their own
JSONL ledger. The ledger audit returned `status: ok`, 9 unique run IDs, and no
missing-arm or duplicate-ID errors.

## Observed records

| Provider/model | Pure visual | Hybrid | Playwright | DB oracle |
|---|---|---|---|---|
| Qwen3.7-Flash | failed: `agent-step-budget` | completed | completed | 3/3 expected product |
| DeepSeek V4 vision | failed: `grounding-loop` | completed | completed | 3/3 expected product |
| Doubao Seed 2.1 | failed: `provider-format` | failed: `provider-format` | completed | 3/3 expected product |

The local ignored ledgers are:

- `artifacts/phase2/run-records/2026-09-11-qwen-prestashop-matched-r2-aligned.jsonl`
- `artifacts/phase2/run-records/2026-09-11-deepseek-prestashop-matched-r2-aligned.jsonl`
- `artifacts/phase2/run-records/2026-09-11-doubao21-prestashop-matched-r2-aligned.jsonl`

## Interpretation boundary

Across repetitions 1–2, the same failure categories recur for this short
clean-stable task family, while the independent database oracle remains healthy
for every record. This is evidence for targeted engineering and failure
attribution, not a universal method ranking: the sample is two repetitions of
one workflow and one condition, provider/model strata remain separate, and no
fault/evolution condition has been collected yet.

The repeated visual Qwen step-budget boundary suggests the current screenshot
grounding/action loop needs a separate repair or ablation. DeepSeek visual
grounding-loop remains an agent outcome unless replay inspection finds an
instrumentation defect. Doubao 2.1 visual and hybrid failures remain
provider-format boundaries until the bounded raw response is audited; they are
not silently converted into agent-capability failures.

## Next gate

Collect repetition 3 under the same clean reset, then run the same matched
block under one isolated functional fault and one behavior-preserving UI
evolution. Only after those pilot strata have enough observations for variance
and power simulation should the repetition count be frozen or application
admission be expanded.
