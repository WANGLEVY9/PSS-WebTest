# Indico clean create-event DeepSeek pilot — 2026-09-13

Evidence boundary: one matched repetition; pilot/provider-readiness evidence,
not a model-capability result.

Playwright passed 1/1 with the reset digest
`1ceb32dc749673dbbeaf7cff591f11b335419191cfdc3c568f889195e901be2d` and the
independent relational oracle. Both DeepSeek agent arms failed before any
browser action with HTTP 404 `Model not exist` from the configured endpoint;
both records are `provider-api` blocked. They must be backfilled only after the
DeepSeek model identifier is corrected and a readiness probe passes.
