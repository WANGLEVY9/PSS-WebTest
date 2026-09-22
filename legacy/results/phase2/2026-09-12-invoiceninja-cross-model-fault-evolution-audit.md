# Invoice Ninja cross-model fault/evolution audit — 2026-09-12

Evidence boundary: this is a pilot/diagnostic audit. It is not a confirmatory
comparison and it does not admit Invoice Ninja to the frozen application set.

## Inputs

- Qwen3.7-VL-Flash fault/evolution records;
- DeepSeek V4.1-Flash tool-call fault/evolution records;
- the scripted Playwright reference records;
- the independent Invoice Ninja database oracle;
- `scripts/audit-run-ledger.mjs` with duplicate and schema checks enabled.

Raw JSONL records stay in the local ignored `code/artifacts/phase2/` directory;
this report stores only bounded counts and failure categories.

## Ledger audit

| Condition | Records | Unique IDs | Visual completed | Hybrid completed | Playwright completed | Audit |
|---|---:|---:|---:|---:|---:|---|
| functional fault | 7 | 7 | 1/2 | 3/3 | 1/2 successful retry | `status=ok` |
| UI evolution | 5 | 5 | 1/2 | 2/2 | 1/1 | `status=ok` |

The failed visual records are retained in the denominators. The two Playwright
fault records include one earlier evaluator-error probe and one successful
retry; they are not silently deduplicated or rewritten.

## Model-stratified interpretation

- Qwen Pure-visual: fault 0/1 and evolution 0/1; both stopped at a
  `provider-format` boundary before the invoice-detail oracle boundary.
- DeepSeek Pure-visual: fault 1/1 and evolution 1/1; both reached the detail
  route, emitted the expected verdict, and passed the independent database
  oracle.
- Qwen Hybrid: fault 1/1 and evolution 1/1 in this probe.
- DeepSeek Hybrid: fault 1/1 and evolution 1/1 in this probe.
- Playwright: successful fault retry and evolution probe both passed; the
  earlier evaluator-error is retained as an execution diagnostic.

These records support a narrow engineering diagnosis: the observed Qwen
Pure-visual failures are model/protocol-stratum boundaries rather than an
arm-wide impossibility or a reset/oracle contamination. They do not establish
that DeepSeek is generally better, because each model/condition cell has only
one completed repetition and the strata are not balanced.

## Admission status

`candidate-not-admitted`. The apply-remove-isolation gate passes, but admission
still requires a frozen reset/image digest, balanced repeated clean/fault/
evolution blocks for all arms and model strata, and a pre-specified pilot
variance rule. Power simulation and confirmatory collection remain frozen.
