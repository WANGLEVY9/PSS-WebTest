# PrestaShop clean-stable matched canary audit — 2026-09-13

Evidence boundary: T1 cross-SUT diagnostic evidence only. These runs do not admit PrestaShop, freeze repetitions, or authorize confirmatory collection.

## Runs

- Profile strata: Aliyun/Qwen 3.7 Flash and DeepSeek V4 Flash Vision.
- Workflow: `prestashop-buyer-search-product`, simple complexity.
- Design: one repetition, clean-stable condition, per-arm reset with up to two reset attempts.
- DeepSeek: 3/3 strict arm records; Playwright, pure visual, and hybrid each reached the clean oracle.
- Qwen round 1: 2/3 executed arms; Playwright and hybrid passed, but the visual arm was excluded by two reset exit-13 failures. This is an infrastructure failure, not a visual-agent result.
- Qwen round 2: 3/3 strict arm records; the first reset required retry, then Playwright, pure visual, and hybrid all passed.

## Ledger checks

The Qwen round-2 ledger contains 3 records with 3 unique IDs and no schema errors; the DeepSeek round-1 ledger contains 3 records with 3 unique IDs and no schema errors. The controller now emits a standard `infrastructure-error` run-record when a reset fails, so future incomplete cells remain visible in the same append-only ledger rather than only in the pilot summary JSON.

The reset-retry boundary remains observable in `reset_attempts` and `reset_retry_used`; no run is silently promoted after a failed reset.

## Interpretation

This canary is a plumbing and cross-SUT consistency check. It suggests the current PrestaShop clean path is executable for Qwen and DeepSeek under a retrying reset policy, but it provides no fault/evolution evidence and no claim about relative strategy quality.
