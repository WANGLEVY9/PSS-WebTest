# BookStack clean navigation diagnostic — 2026-09-13

Evidence boundary: one Qwen clean-stable matched pilot retry; not application admission or confirmatory evidence.

- SUT reset succeeded for all three arms and the visible Playwright oracle was available.
- Playwright and pure visual each passed in both the initial and retry block.
- Hybrid failed in both blocks because the provider emitted a click without a `target_id` or finite coordinates; the strict hybrid parser rejected it before browser execution. The SUT was reachable and the independent visible oracle was not the failing boundary.
- The failure is now classified as `provider-format` (malformed hybrid pointer output), not `execution`; no fallback click or implicit target inference was added.

This diagnostic separates a provider decision-format limitation from SUT/reset failure. Hybrid reliability remains below admission threshold for this workflow, so no repetition freeze or cross-application expansion is authorized from this result.
