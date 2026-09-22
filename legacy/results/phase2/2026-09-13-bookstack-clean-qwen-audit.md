# BookStack clean navigation diagnostic — 2026-09-13

Evidence boundary: one Qwen clean-stable matched pilot retry; not application admission or confirmatory evidence.

- SUT reset succeeded for all three arms and the visible Playwright oracle was available.
- Playwright and pure visual each passed in both the initial and retry block.
- Hybrid failed in both blocks because the provider emitted a click without a `target_id` or finite coordinates; the strict hybrid parser rejected it before browser execution. The SUT was reachable and the independent visible oracle was not the failing boundary.
- The failure is now classified as `provider-format` (malformed hybrid pointer output), not `execution`; no fallback click or implicit target inference was added.

This diagnostic separates a provider decision-format limitation from SUT/reset failure. A follow-up run used the frozen `aliyun-qwen-grounded-v1` optimization profile plus a schema-level semantic-hybrid tool contract: click-like actions require a visible `target_id`, while non-pointer actions require their corresponding argument. The matched block then passed 3/3 (Playwright, pure visual, and Hybrid), with reset and independent oracle success for every arm. Artifact: `bookstack-navigation-clean-stable-aliyun-qwen3.7-flash-phase2-t1-bookstack-clean-qwen-semantic-schema-pilot.json`.

Interpretation: the earlier Hybrid failures were at least partly an engineering/provider-protocol boundary, and the schema repair is effective for this clean navigation task under Qwen. This is still a one-repetition diagnostic pilot: it does not establish reliability, application admission, repetition freeze, or confirmatory evidence. The next gate is matched fault/evolution on BookStack with the same schema and ledger, followed by additional repetitions only if all three conditions remain complete.
