# BookStack live recovery and follow-up pilot (2026-08-24)

## Infrastructure diagnosis and recovery

The original `127.0.0.1:8081` failure had two independent causes:

1. Colima's default profile was in `Broken` state and Docker could not connect to its socket.
2. A pre-existing SSH process was listening on host port 8081, so port ownership had to be checked before any destructive action.

No SSH process was terminated. Colima was stopped and restarted with Docker runtime, aarch64 VM, VZ, Rosetta amd64 emulation, 4 CPUs, and 8 GiB memory. The BookStack lifecycle then performed a project-scoped reset. It passed:

- database ready;
- HTTP ready at `http://127.0.0.1:8081` with status 302;
- seed verification: `users=2`, `books=3`, `pages=6`;
- independent persisted-state oracle on the clean state: `matches=0`, `passed=false`.

The lifecycle now accepts `PSS_BOOKSTACK_APP_PORT` and passes it to Compose. `BOOKSTACK_BASE_URL` is used by the runners, so a port conflict can be resolved without editing ignored third-party files.

## Live clean matched pilot

### Navigation task

Command configuration: `PSS_MATCHED_REPETITIONS=3`, `CUA_MAX_STEPS=8`, `CUA_TIMEOUT_MS=30000`, `PSS_RESET_MAX_ATTEMPTS=2`.

- Playwright: 3/3 cells passed;
- pure visual: 3/3 cells passed;
- hybrid: 3/3 cells passed;
- matched successful repetitions: 3/3;
- reset failures: 0 for all arms.

This establishes a recovered infrastructure gate and a successful navigation pilot, not a confirmatory estimate.

### Create-page persistence task

Command configuration: `PSS_MATCHED_REPETITIONS=3`, `CUA_MAX_STEPS=16`, `CUA_TIMEOUT_MS=30000`, `PSS_RESET_MAX_ATTEMPTS=2`.

- Playwright: 3/3 cells passed;
- pure visual: 0/3 cells passed. All three failures were execution failures caused by repeated non-progressing clicks at the same coordinate (`x=962, y=138`), while the independent oracle was transiently positive. They are not counted as successful cells;
- hybrid: 2/3 cells passed. One failure was an invalid JSON tool-call argument response, with the independent oracle not passing;
- matched successful repetitions: 0/3;
- reset failures: 0 for all 9 cells.

The result moves the bottleneck decisively away from BookStack reset/seed infrastructure and toward agent grounding/planning and provider output stability on the rich-text workflow. It is exactly the failure-boundary evidence the study is designed to measure.

## Interpretation and gate

The navigation task now satisfies a pilot admission gate for clean matched execution. The create-page task does not. We therefore do not freeze repetitions, run power-based confirmatory collection, or extend Indico/Juice Shop as confirmatory arms from this result. The failure records remain in the local ledger for later failure-mode and maintenance analysis.
