# Phase 2 ledger and benchmark-matrix increment (2026-08-23)

## Scope

This increment improves the experimental framework only. It does not add repetitions, tune a provider prompt, or start confirmatory collection.

## Standard run-record coverage

The traditional Playwright arm now uses the same immutable record constructor as the visual and hybrid arms:

- `code/src/traditional-run-record.mjs` records execution status, independent-oracle outcome, wall-clock duration, explicit scripted interaction count, and a trace hash.
- `bookstack-matched-pilot.mjs`, `indico-matched-pilot.mjs`, and `juice-shop-matched-pilot.mjs` append the Playwright record to their existing JSONL ledger.
- `run-bookstack-playwright-cell.mjs` now measures elapsed time and interactions and appends when `PSS_RUN_RECORD_OUT` is set.
- Credentials, screenshots, traces, and arbitrary provider metadata are not written to the record; only the existing hash-based provenance is retained.

The `actions` field is deliberately defined as the number of explicit scripted interactions in the test sequence. It is not presented as a browser event count or as a model action count.

## Benchmark expansion matrix

`code/config/benchmark-matrix.v0.1.json` declares 15 workflows across BookStack, Indico, and Juice Shop, four model strata, five traditional baseline strata, and clean/fault/evolution conditions. The three currently exercised tasks are labelled `admitted-pilot-only` or `pilot-only`; all additional workflows are labelled `candidate` and have `oracle_status=draft`.

The matrix therefore provides breadth for planning without silently promoting unverified tasks into the study sample. The admission rule remains: reset, independent oracle, all three arms, and clean pilot evidence are required before a workflow can enter confirmatory collection.

## Verification

- `npm run test:contracts`: 33/33 passed.
- `npm run validate:manifests`: passed (3 applications, 3 currently executable tasks).
- `npm run validate:benchmark-matrix`: passed (3 applications, 15 workflows, 4 model strata, 5 traditional baselines).
- Node syntax checks and `git diff --check`: passed.

## Remaining scientific gates

This increment does not change the current conclusion: BookStack has a clean 3×3 pilot, while Indico and Juice Shop still have only one repetition and visual/hybrid failures. Repetition freezing, power simulation, fault/evolution three-arm expansion, and confirmatory collection remain blocked until the agent admission gate is met.
