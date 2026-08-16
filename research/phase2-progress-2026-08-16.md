# Phase 2 progress log — 2026-08-16

## Scope policy

Phase 2 uses **2023-01-01 onward as the primary evidence window** for benchmark, Web-agent, repair, and empirical-design decisions. Earlier work remains in the repository only when it defines terminology or a baseline taxonomy that has no adequate post-2023 replacement. It is not used to support a claim about the current state of CUA testing.

## Work completed in this increment

1. Installed the declared Node dependencies for the harness (`@playwright/test` and `dotenv`); `package-lock.json` is now present and records the resolved versions.
2. Added a machine-readable task manifest with three provisional SUTs: BookStack 25.02.1, Indico 3.3.6, and OWASP Juice Shop 20.0.0. These are candidates, not admitted confirmatory applications.
3. Added explicit schemas for task manifests and immutable run records. The run schema keeps method failure, evaluator failure, infrastructure failure, timeout, and model refusal distinct.
4. Added `npm run validate:manifests`, which rejects missing study cutoff, duplicate application/task IDs, unspecified license/reset status, missing independent oracle assertions, and incomplete three-arm coverage.
5. Added `npm run check:sut`, a local-only readiness probe and application-specific lifecycle wrappers.
6. The bundled Playwright Chromium download was interrupted by `ECONNRESET`; a real launch with the locally installed Google Chrome 151.0.7922.138 passed. This is sufficient for feasibility, but confirmatory runs still need a frozen browser build/channel.

## Current gate status

| Gate | Status | Evidence | Next action |
|---|---|---|---|
| Node harness dependencies | **PASS** | `npm install`; lockfile present; Playwright CLI reports 1.62.1 | Keep lockfile and run a clean-install check in CI |
| Browser runtime | **PASS FOR FEASIBILITY** | Playwright launched local Chrome 151.0.7922.138 | Freeze one browser artifact/channel before preregistration |
| Docker/Compose SUT runtime | **PASS** | Colima 0.10.3, Docker CLI 29.7.2, Compose 5.4.0; arm64 VM with Rosetta | Preserve exact host/VM/image provenance |
| BookStack reset | **PASS FOR FEASIBILITY** | 10/10 clean reset/workflow/oracle cycles | Resolve upstream/bundle provenance before admission |
| Indico reset | **PASS FOR FEASIBILITY** | Three clean-volume cycles; exactly 18 seeded events restored | Build the task and independent event oracle |
| Juice Shop reset | **PASS FOR FEASIBILITY** | Two ephemeral-container cycles; fixed API probe count 3 | Audit task representativeness and implement an oracle |
| Independent oracle | **PARTIAL PASS** | BookStack DB oracle verified on clean and injected-fault states | Indico and Juice Shop oracles remain draft |
| Observation isolation | **CONTRACT PASS** | Six strict contract/leakage tests pass | Real provider trajectories still need admission tests |
| Three-arm vertical slice | **BLOCKED** | Playwright arm runs; visual/hybrid contracts exist but no real CUA provider is configured | Implement and execute real provider adapters under one budget |

## Decisions made

- BookStack remains the first task-level vertical slice; Indico is the higher-complexity candidate and Juice Shop the lightweight fallback. All remain provisional until their task oracle, provenance, and three-arm admission gates pass.
- Invoice Ninja is excluded from the initial implementation pending its upstream Elastic License and service/runtime review.
- The task manifest records the post-2022 evidence cutoff explicitly so new implementation decisions do not silently rely on obsolete agent or benchmark assumptions.
- A task with a draft or missing independent oracle cannot contribute to confirmatory effectiveness results.
- No smoke-trial number will be reported as experimental evidence until the application version, reset snapshot, observation contract, and evaluator hash are recorded.

## Immediate next gate

The BookStack feasibility slice is complete. The next gate is to implement provider-specific pure-visual and hybrid adapters, run both against the same BookStack intent under a fixed budget, and prove from retained trajectories that the visual arm received no DOM/accessibility payload. In parallel, the Indico and Juice Shop task oracles must move from draft to verified before either application can be admitted.

## Second implementation increment

- Installed Colima 0.10.3, Docker CLI 29.7.2, and Docker Compose 5.4.0.
- Created an Apple Virtualization (`vz`) arm64 VM with Rosetta enabled: 4 CPUs, 8 GiB RAM, 40 GiB disk. Docker server reports arm64; execution of WebTestPilot's amd64 images must therefore be recorded as translated rather than native.
- Implemented a portable BookStack lifecycle wrapper that avoids WebTestPilot's macOS-incompatible `date -d` call and never edits the third-party checkout.
- Implemented a fixed persisted-state database oracle for the BookStack create-page pilot.
- Implemented and passed six strict observation-contract tests, including rejection of DOM, accessibility tree, hybrid structure, undeclared fields, mutation labels, and gold-oracle leakage in the pure-visual arm.
- Found a provenance discrepancy requiring resolution: WebTestPilot's `webapps/README.md` links the BookStack bundle to LinuxServer, while the checked-out Dockerfile actually builds from `solidnerd/bookstack:25.2.1`. The built base image and final digest, not the README link alone, must be recorded before admission.
- Completed the first BookStack clean-start pull/build and froze the local image identities. This remains feasibility work only; no result is confirmatory evidence.

## BookStack vertical-slice result

- Playwright successfully launched the locally installed Google Chrome 151.0.7922.138; the bundled Chromium download is no longer a feasibility blocker. Confirmatory work must still freeze one browser build/channel.
- The first clean BookStack start reached HTTP 302 on port 8081 and loaded the fixed seed.
- The independent database oracle correctly returned `matches=0` before the workflow and `matches=1` after the accessibility-locator Playwright workflow.
- Ten additional non-confirmatory cycles each performed volume reset, negative oracle, Playwright create-page workflow, and positive oracle. All 10/10 passed.
- Across those local cycles, reset time ranged from 11,792 to 12,291 ms (mean 11,963.6 ms); Playwright process time ranged from 3,311 to 3,682 ms (mean 3,461.9 ms). These values characterize this feasibility machine only and are not study outcomes.
- Frozen local provenance: WebTestPilot commit `b0659bd9908f11c7957602a9372fc100dda50e40`; `solidnerd/bookstack` digest `sha256:62bb3332b1a1a5cbc518792aa2d288b8eaa86ff7db13b6021c728e79c5b0ed7c`; built app image `sha256:1965ab6a50ed2ff3502de265154a2f42baceeb2e311b1467bf864087a676abd1`; MySQL digest `sha256:b3b90af2a6552ae30c266fdb7d5dd55f3afb72404bb78d37fe8a23eb857fd3fb`.

The behavior-preserving `bookstack-layout-v1` mutation changed typography, header height, content width, spacing, and button radius while the Playwright workflow and persisted-state oracle still passed in a smoke run. A controlled `persistence-mismatch` database trigger then corrupted only the target page during save: Playwright saw the corrupted visible content and failed, the independent oracle returned `matches=0`, and a direct database query showed the expected page row with the corrupted body. A subsequent volume reset removed both the trigger and test data.

BookStack now passes the local reset, Playwright, independent-oracle, functional-fault-detection, UI-evolution, and repeated-clean-run feasibility gates. It remains provisional because the WebTestPilot README/image provenance discrepancy still needs a publication-quality license and artifact trace.

## Indico lifecycle result

- Built the WebTestPilot Indico 3.3.6 worker once as native arm64 image `sha256:4cc4a2cfe59e0b0c0e8e9ab1c03e5b4b8d8f46d0c8d1dea08698f7ca8f89559e`; a Compose override prevents the inherited YAML build anchor from launching three duplicate builds.
- Three clean-volume start/reset cycles brought up Web, Celery, Celery Beat, PostgreSQL, Redis, and Nginx and restored exactly 18 seeded events. The latest cycle reached HTTP 200 in 12,410 ms, automatically asserted the event count, and completed in 33,841 ms.
- Indico is hostname-sensitive: its checked-in `BASE_URL` is `http://localhost:8080`; probing `127.0.0.1` returns 404 even when healthy. The lifecycle gate now requires the canonical host and a 2xx/3xx response.
- The bundled startup script invokes removed command `indico populate`, but continues into `indico db prepare`; the repository seed SQL was then imported successfully. This compatibility warning is recorded and must not be hidden.
- Reset feasibility passes, but the create-event workflow and independent relational oracle are still draft. The six-service footprint makes Indico a higher-cost SUT.

## Third fallback result: OWASP Juice Shop

- Selected the post-2023, MIT-licensed OWASP Juice Shop v20.0.0 as a lightweight fallback and used the official multi-architecture image `bkimminich/juice-shop@sha256:fd58bdc9745416afce8184ee0666278a436574633ea7880365153a63bfd418b0` (arm64).
- Two ephemeral-container start/reset cycles returned HTTP 200 and the same three-product fixed API probe. The first cycle, including download, took 138,571 ms; the cached reset took 2,241 ms.
- This establishes reset feasibility only. The product-search task, state oracle, fault, and UI evolution remain draft, so Juice Shop is provisional rather than confirmatory-admitted.

## Phase 2 exit assessment

The three-candidate deterministic reset sub-gate is now satisfied locally. Phase 2 as a whole is **not exited**: the visual and hybrid arms have isolation contracts but no real provider execution; only BookStack has a verified task/oracle/fault/evolution vertical slice; and Indico/Juice Shop task-level oracles remain drafts. No value above is a confirmatory study result.
