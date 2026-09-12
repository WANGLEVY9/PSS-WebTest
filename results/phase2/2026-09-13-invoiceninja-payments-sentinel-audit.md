# Invoice Ninja second-workflow sentinel audit — 2026-09-13

This is T1 diagnostic evidence only. It does not admit Invoice Ninja, freeze repetitions, or authorize confirmatory collection.

## Scope

- Workflow: `invoiceninja-recent-payments` (authenticated dashboard → Payments)
- Conditions: `clean-stable`, `functional-fault` (visible payment-row omission), `ui-evolution` (presentation-only CSS)
- Strata: Playwright; Qwen pure-visual and hybrid; DeepSeek pure-visual and hybrid; Doubao hybrid
- Matched design: one reset per condition block, deterministic pseudo-random arm order, 18 run-records

## Evidence checks

- `npm run test:contracts`: 171/171 passed.
- `node scripts/audit-run-ledger.mjs code/artifacts/phase2/invoiceninja-payments-matched-runs.jsonl`: 18 records, 18 unique run IDs, no schema errors or duplicate IDs.
- Playwright clean/fault/evolution baselines: 3/3 strict passes.
- The independent oracle is the persisted `payments` row (`number=0001`, `status_id=4`, `amount=120000`, `refunded=0`, `applied=120000`, `is_deleted=0`). It is never supplied to any arm.

## Diagnostic result

The matched controller produced 12 strict passes out of 18. The complete per-stratum table is in `2026-09-12-invoiceninja-payments-matched-pilot-payments-sentinel.md`.

Interpretation is deliberately boundary-specific:

- Playwright: 3/3 strict passes.
- Qwen: clean 2/2, UI evolution 2/2; fault visual failed at `grounding-loop`, fault hybrid reached the state but failed `provider-format` termination.
- DeepSeek: clean visual/hybrid 2/2; UI evolution visual/hybrid 2/2; fault hybrid 1/1; fault visual failed at `agent-step-budget`.
- Doubao hybrid: 0/3; all three failures were `provider-api` and the independent oracle still passed. These are provider-boundary failures, not evidence that the workflow state was incorrect.

The result supports continued T1 reliability work and model/provider stratification. It is not a universal ranking and cannot be pooled across providers or promoted to confirmatory evidence.
