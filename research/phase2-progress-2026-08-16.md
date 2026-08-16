# Phase 2 progress log — 2026-08-16

## Scope policy

Phase 2 uses **2023-01-01 onward as the primary evidence window** for benchmark, Web-agent, repair, and empirical-design decisions. Earlier work remains in the repository only when it defines terminology or a baseline taxonomy that has no adequate post-2023 replacement. It is not used to support a claim about the current state of CUA testing.

## Work completed in this increment

1. Installed the declared Node dependencies for the harness (`@playwright/test` and `dotenv`); `package-lock.json` is now present and records the resolved versions.
2. Added a machine-readable task manifest with two provisional SUTs: BookStack 25.02.1 and Indico 3.3.6. These are candidates, not admitted confirmatory applications.
3. Added explicit schemas for task manifests and immutable run records. The run schema keeps method failure, evaluator failure, infrastructure failure, timeout, and model refusal distinct.
4. Added `npm run validate:manifests`, which rejects missing study cutoff, duplicate application/task IDs, unspecified license/reset status, missing independent oracle assertions, and incomplete three-arm coverage.
5. Added `npm run check:sut`, a local-only readiness probe. Against the default URL it currently reports `unreachable`, which is expected because no SUT is running.
6. Attempted to install the Playwright Chromium browser. The package install succeeded; the browser download was interrupted by `ECONNRESET`, so browser execution is not yet admitted as ready.

## Current gate status

| Gate | Status | Evidence | Next action |
|---|---|---|---|
| Node harness dependencies | **PASS** | `npm install`; lockfile present; Playwright CLI reports 1.62.1 | Keep lockfile and run a clean-install check in CI |
| Chromium runtime | **BLOCKED** | CDN download failed with `ECONNRESET` | Retry from a permitted network/cache or use a documented preinstalled browser |
| Docker/Compose SUT runtime | **BLOCKED** | `docker`, `colima`, and `podman` absent from PATH on arm64 host | Install/document runtime, then record architecture and image digests |
| BookStack reset | **NOT TESTED** | WebTestPilot seed evidence exists; no local start/reset run | Run two fresh-directory start/reset cycles |
| Indico reset | **NOT TESTED** | WebTestPilot seed evidence exists; no local multi-service run | Run two fresh-directory start/reset cycles |
| Independent oracle | **DRAFT** | Assertions are specified in manifest, not yet connected to app state | Implement and test DB/API assertions |
| Three-arm vertical slice | **NOT STARTED** | Task contracts exist; no application endpoint available | Connect Playwright baseline, then agent adapters |

## Decisions made

- BookStack and Indico remain the first vertical-slice candidates because both have permissive upstream licenses and pinned WebTestPilot references; neither is admitted until local reset and oracle tests pass.
- Invoice Ninja is excluded from the initial implementation pending its upstream Elastic License and service/runtime review.
- The task manifest records the post-2022 evidence cutoff explicitly so new implementation decisions do not silently rely on obsolete agent or benchmark assumptions.
- A task with a draft or missing independent oracle cannot contribute to confirmatory effectiveness results.
- No smoke-trial number will be reported as experimental evidence until the application version, reset snapshot, observation contract, and evaluator hash are recorded.

## Immediate next gate

The next implementation increment is a BookStack-only vertical slice. It must provide: `start`, `ready`, `login`, `snapshot`, `reset`, and `stop`; one persisted-state assertion; ten repeated clean Playwright runs; one behavior-preserving UI mutation; and a leakage test showing that the visual arm receives no DOM/accessibility payload. If the Docker/architecture gate remains blocked, the result is a documented feasibility blocker rather than a benchmark result.
