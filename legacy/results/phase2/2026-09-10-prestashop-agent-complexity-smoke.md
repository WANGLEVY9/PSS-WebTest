# PrestaShop CUA/Hybrid complexity smoke (2026-09-10)

## Scope

This smoke exercised the same three read-only buyer-search workflows that define the traditional 500-run plan:

| Complexity | Workflow | Completion criterion |
|---|---|---|
| simple | search for `Mug` | target product visible in search results |
| medium | search, open target product | target product detail page visible |
| complex | search, open, browser-back, reopen | target detail page visible after the second open |

The provider/model/profile stratum was fixed to Aliyun-compatible `qwen3.7-flash` with `aliyun-qwen-grounded-v1`. Pure visual received screenshots only; Hybrid received screenshots plus the declared visible page structure and used semantic target IDs. Each run used a fresh browser context, an independent database oracle, and a persisted replay record. These are diagnostic smoke observations, not matched or confirmatory estimates.

## Observed runs

| Arm | Simple | Medium | Complex | Notes |
|---|---:|---:|---:|---|
| Pure visual | failed (grounding-loop) | passed | failed (grounding-loop) | provider repeatedly selected non-progressing header coordinates in two runs |
| Hybrid | passed | passed | passed | complex run required browser-back handling in the runner |

The first complex attempt in both arms exposed an engineering defect: the action executor passed the model's `back` key to Playwright's keyboard API, which does not define that key. The runner now maps `BACK`, `ALT+LEFT`, and `BROWSER_BACK` to a browser `goBack` transition. The subsequent Hybrid complex smoke passed, including the second product-detail milestone. The Pure visual complex retry then reached a provider grounding loop before search; this is retained as agent evidence rather than converted into a pass.

The independent database oracle returned the expected catalog row for every smoke, including failed agent executions. This separates agent navigation failure from SUT data loss. The smoke therefore supports starting low-concurrency diagnostic batches, but does not admit either agent arm for confirmatory collection.

## Reproducibility

```bash
npm run validate:prestashop-agent-500-plan
npm run test:contracts
PSS_ARM=visual PSS_AGENT_COMPLEXITY=medium node scripts/run-prestashop-agent-cell.mjs
PSS_ARM=hybrid PSS_AGENT_COMPLEXITY=complex node scripts/run-prestashop-agent-cell.mjs
```

Credentials and provider keys are supplied only through the ignored local environment; no secrets or raw replay images are committed.
