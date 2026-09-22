# Local benchmark resumption — gate-constrained

Cloud deployment is deferred at the user's request. No company host was contacted. No agent requests or new benchmark outcomes were generated in this round: none of the three core benchmarks currently meets the requested execution gates.

## Actual local diagnostic

The existing WAV Shopping instance passed its official controller health and HTTP navigation probe. This is service readiness, not verified reset or study admission.

On the retained, project-owned, mount-free isolation container, a bounded recovery diagnostic waited for official service health before requesting a homepage. Earlier polls reported Elasticsearch UNHEALTHY while MySQL, Redis and other services were healthy. At the seventh poll all dependencies were healthy; one homepage request returned HTTP 200 with 164,865 bytes in **57,101 ms**. The clone was then stopped. No task-state mutation was performed.

This supports a startup dependency/cold-page latency explanation for the previous 20-second warmup failures. It does not isolate a sole cause: this was a retained initialized container restart, not a fresh-image controlled comparison. Neither this observation nor the earlier equal-cardinality checks prove reset fidelity.

The reset preflight now waits on every official dependency and makes one bounded 90-second homepage request, consuming the response body and rejecting redirects/errors. It no longer accumulates six timed-out homepage requests. These are provisioning changes outside agent budgets; the Visual/Hybrid input contracts, decisions, time budgets and answer evaluation are unchanged. The revised three-cycle fresh reset probe has **not** yet completed; this patch is not live reset evidence.

## Executable admission boundary

The previous diagnostic opt-in could reach the runner despite missing database reset evidence. The CLI now checks admission before loading credentials, exporting official task inputs, creating run directories or making model calls. The API and English UI share the same gate. Evidence must be fresh, source-pinned and benchmark-admitted; a code-level false capability explicitly reflects the runner's currently missing per-arm database reset. Changing an environment flag or claiming admission in a JSON file cannot supply that missing implementation.

The runner must implement and validate per-arm reset before this capability can change. Do not flip it to collect more data. High agent success is never a gate. The conformance audit still cannot authorize confirmatory collection.

Negative verification: CLI with diagnostic opt-in exits before task export; API with opt-in and a non-real test credential returns 409 without launching a task; the real browser keeps collection disabled and displays reasons.

## Remaining sequence

1. Complete fresh-image controlled mutation/content-restoration/neighbor-isolation reset checks; retain failed attempts.
2. Implement the verified reset recipe before every arm/repetition and bind evidence to the actual instance and task scope.
3. Resolve task-specific native evaluator errors and complete dynamic information-boundary audits before admitted diagnostic task runs.
4. Keep VWA image provisioning blocked on local VM capacity; keep ATA blocked on fixture-label equivalence and population adjudication. Do not substitute self-built tasks into the official denominator.
5. Only after relevant gates pass, run bounded matched diagnostics on already exposed development tasks. Human screening, blinded Traditional adaptation and preregistered freezes remain separate requirements for confirmatory collection.

Historical ledger remains five batches / 33 records / seven development tasks. Regression results and sanitized diagnostic evidence are in `results/local-runtime/2026-09-21-local-resumption.json`; raw service observations remain private under `code/artifacts/local-runtime`.
