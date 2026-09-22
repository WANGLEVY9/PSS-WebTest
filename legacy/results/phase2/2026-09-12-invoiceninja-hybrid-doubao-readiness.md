# Invoice Ninja Hybrid Doubao readiness — 2026-09-12

Evidence boundary: one live provider-readiness/SUT probe. This is not a
capability comparison and is not pooled with the Qwen or DeepSeek matched
pilot records.

## Probe

- SUT: Invoice Ninja `5.11.61`, independently reset before the run;
- arm: Hybrid screenshot + allow-listed page structure;
- provider/model: Volcengine Ark `doubao-seed-2-1-pro-260628`;
- observation contract: `screenshot-plus-structure`;
- run id: `invoiceninja-hybrid-doubao-clean-r1`;
- independent database oracle: passed (seeded invoice row unchanged);
- agent actions: none (provider request failed before the first action).

## Boundary

The provider returned HTTP 429: the account reached the inference limit for
the `doubao-seed-2-1-pro` model and the service was paused under Safe Experience
Mode. The standard run-record therefore stores `status=test-failure`,
`failure_category=provider-api`, `checkpoint_reached=false`, and
`independent_oracle_passed=true`.

This is an external account/quota block, not evidence that Hybrid cannot use
Doubao and not evidence against the SUT. The profile remains configured as a
separate Hybrid model stratum, but it is **blocked and excluded from pooled
success rates** until the Ark model service is reactivated.

## Follow-up gate

After the model is reactivated, rerun the same clean, functional-fault, and
UI-evolution matched blocks with a fresh reset. Do not replace this blocked
record or silently treat it as a model failure; report it as an external
availability boundary.
