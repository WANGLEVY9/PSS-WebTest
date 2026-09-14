# VisualWebArena gate audit — 2026-09-14

Command: `npm run gate:visualwebarena`

| Service | Endpoint | Observation |
|---|---|---|
| Classifieds | `127.0.0.1:9980` | fetch failed |
| Shopping | `127.0.0.1:7770` | fetch failed |
| Reddit | `127.0.0.1:9999` | request timeout |
| Homepage | `127.0.0.1:4399` | fetch failed |
| Classifieds reset token | local configuration | not configured |

The gate returned `infrastructure-gate-failed`, `ready=false`, and
`study_execution_allowed=false`. No VisualWebArena task, arm, evaluator, or
provider request was executed. These observations therefore remain an
environment prerequisite failure and do not enter any experimental
denominator.

The pinned source commit remains
`89f5af29305c3d1e9f97ce4421462060a70c9a03`. To retry the gate, start the four
version-pinned services and provide the reset token through the ignored local
environment configuration; do not alter the benchmark task set or evaluator.
