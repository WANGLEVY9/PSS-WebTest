# WebArena-Verified Shopping environment gate v0.1

Date: 2026-09-14

Status: **health, restart-recovery, and task-state projection gates passed;
confirmatory execution remains closed by the global benchmark admission gate**

The digest-pinned candidate image
`am1n3e/webarena-verified-shopping@sha256:3e8cb9b945ea9b1c94ab26dba53e8d12dd0406abbf4bf686fd3bb2b6a5908feb`
was started on the local Colima Docker runtime. The observed image ID exactly
matched that digest.

The default arm64 Colima daemon was not used for this image. An isolated
`webarena-x86` Colima profile was started with QEMU and `x86_64`; Docker
reported `x86_64` and the image metadata reported `amd64`. The gate now
normalizes these equivalent architecture names and confirms:

```text
image_matches=true
host_architecture=x86_64
image_architecture=amd64
normalized_architecture=amd64/amd64
architecture_compatible=true
```

The container was recreated as `webarena-verified-shopping-x86`, with the
canonical ports `7770` (storefront) and `7771` (environment controller). The
controller returned HTTP 200 with `success=true`; nginx, PHP-FPM, MariaDB,
Redis, Elasticsearch, mailcatcher, cron, and env-ctrl were running/healthy at
the successful probe. The storefront returned the expected HTTP 302 redirect
to its canonical `localhost:7770` base URL. The gate therefore classifies the
deployment as `environment-ready`.

## Follow-up probe

The strengthened gate records the architecture fields explicitly:

```text
host_architecture=x86_64
image_architecture=amd64
architecture_compatible=true
image_matches=true
ready=true
```

## Restart-recovery probe

`npm run gate:webarena:shopping:reset` was run with three independent Docker
restart cycles. All three cycles recovered the controller and storefront after
cold-start service initialization (`recovered=true` for cycles 1--3). During
cold start, Elasticsearch temporarily reported `UNHEALTHY`/red while shards
initialized; the probe waited until the controller reported healthy before
counting recovery. Transient connection errors were retained as
`probe_error` diagnostics and were not treated as restart failures.

```text
reset_cycles=3
cycle_1=recovered
cycle_2=recovered
cycle_3=recovered
classification=reset-recovery-ready
```

## Task-state reset projection

The new `npm run gate:webarena:shopping:state-reset` probe was run with three
independent delete-and-recreate cycles from the fixed image. Every cycle had
no persistent mounts, matched the expected image digest, recovered all
services, and produced the same application-state projection:

```text
reset_cycles=3
state_digest_stable=true
baseline_state_digest=73c22b644b6042db6ddd02a970ad7c93d9a4d6a9a3277a6b62ed1629a25bf79e
volatile_tables_excluded=cron_schedule,queue_message,queue_message_status
classification=state-reset-ready
state_reset_verified=true
```

The projection consists of MariaDB application table cardinalities and a
schema digest (with automatically assigned `AUTO_INCREMENT` values
canonicalized). Magento scheduler and message-queue tables were excluded
only after an explicit fresh-recreate diff showed that they are populated by
service startup; they are runtime bookkeeping rather than user task state.
Redis session/key counts are likewise not used as a baseline because they
change during service startup. This scope is recorded in the gate output as
`mariadb-application-cardinality-and-schema-v1` and must remain unchanged for
future runs.

This closes the WebArena Shopping **local state-reset projection** gate. It
does not by itself admit a benchmark: the outcome-blind screening ledger,
Traditional adaptation, common evaluator, and three-arm feasibility gates are
still pending. The reset probe therefore continues to emit
`study_execution_allowed=false`.

## Gate implementation notes

- `probe-webarena-shopping-gate.mjs` now normalizes `x86_64`/`amd64` and treats
  a non-error HTTP 3xx as reachable for the site probe. It polls the controller
  and storefront during cold start (bounded by `PSS_WEBARENA_HEALTH_MAX_POLLS`)
  and accepts an explicit `PSS_WEBARENA_DOCKER_CONTEXT` so host architecture
  and the inspected container cannot silently come from different Docker
  daemons.
- `probe-webarena-shopping-reset-gate.mjs` separates Docker restart errors from
  transient health-probe errors and allows a 120-second cold-start window; its
  Docker commands honor the same explicit context and bounded command timeout.
- `probe-webarena-shopping-state-reset-gate.mjs` uses the explicit context for
  delete-and-recreate operations and state capture, preventing the previously
  observed cross-daemon port collision (`PSS_WEBARENA_DOCKER_CONTEXT=colima-webarena-x86`).
- Neither gate authorizes a study arm. Failures remain classified as
  `infrastructure-gate-failed`, never as CUA, Hybrid, Traditional, task, or
  oracle outcomes.
