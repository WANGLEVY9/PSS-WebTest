# VisualWebArena gate audit — 2026-09-14

Command: `PSS_VWA_CLASSIFIEDS_RESET_TOKEN=<documented-default> npm run gate:visualwebarena`

| Service | Endpoint | Observation |
|---|---|---|
| Classifieds | `127.0.0.1:9980` | fetch failed |
| Shopping | `127.0.0.1:7770` | HTTP 302; reachable (canonical redirect) |
| Reddit | `127.0.0.1:9999` | request timeout |
| Homepage | `127.0.0.1:4399` | fetch failed |
| Classifieds reset token | local configuration | supplied for this probe from the benchmark's documented default; not persisted |

The gate returned `infrastructure-gate-failed`, `ready=false`, and
`study_execution_allowed=false`. The shopping service is now reachable via
the isolated x86 WebArena container and its HTTP 302 is accepted as a healthy
reachability result. Classifieds, Reddit, and the homepage remain unavailable;
therefore the all-services gate is still closed. No VisualWebArena task, arm,
evaluator, or provider request was executed. These observations remain an
environment prerequisite failure and do not enter any experimental
denominator.

The reset token was passed only as a process environment variable for this
probe. It was not written to the repository or any run ledger. The benchmark
default is recorded here solely as source-documented configuration evidence;
the eventual reset gate must exercise the live endpoint and prove recovery
before any task is admitted.

## Local asset probe

Command: `npm run probe:visualwebarena:assets`

The read-only asset probe observed Docker architecture `x86_64` and the
running WebArena-Verified shopping image. It did **not** find the official VWA
image names `shopping_final_0712` or `postmill-populated-exposed-withimg`, nor
the downloaded Classifieds compose bundle. The checked-out VWA source does
contain the homepage template, but that source alone is not a running service.
The result was `official-assets-missing`, `ready_for_service_start=false`, and
`study_execution_allowed=false`. The Reddit image archive is approximately
49.7 GB at the documented Archive.org mirror, so it was not downloaded as an
unbounded troubleshooting action; the blocker is recorded for an explicit
environment-provisioning decision.

The Classifieds archive itself is small, but its compose file references
`jykoh/classifieds:latest`; the Docker manifest advertises a 76.6 GB layer.
Consequently, downloading the compose bundle alone cannot make the service
reproducible on this workstation. The image must be provisioned on a host with
adequate disk and memory, then digest-pinned before admission.

## Follow-up reachability probe

For a bounded engineering check, the pinned homepage source was copied to an
ephemeral directory, its documented hostname placeholder was replaced with
`127.0.0.1`, and the source Flask app was started in a live terminal process.
The subsequent gate observed homepage HTTP 200 and shopping HTTP 302. This is
useful service-level evidence, but it is not yet a reproducible deployment
artifact: the process is intentionally not treated as a benchmark image and
must be recreated by an explicit setup procedure before admission. Classifieds
and Reddit remain unavailable, so the four-service gate remains closed.

The pinned source commit remains
`89f5af29305c3d1e9f97ce4421462060a70c9a03`. To retry the gate, start the four
version-pinned services and provide the reset token through the ignored local
environment configuration; do not alter the benchmark task set or evaluator.
