# WebArena-Verified Shopping environment gate v0.1

Date: 2026-09-14

Status: **health and restart-recovery gates passed; task-level state reset and
confirmatory execution remain closed**

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

This is a **restart-recovery** result, not proof that task-level database
state is reset to the benchmark baseline. The reset gate consequently emits
`state_reset_verified=false` and `study_execution_allowed=false`. Before any
confirmatory arm is launched, the official WebArena reset procedure and a
baseline state digest must be implemented and independently checked.

## Gate implementation notes

- `probe-webarena-shopping-gate.mjs` now normalizes `x86_64`/`amd64` and treats
  a non-error HTTP 3xx as reachable for the site probe.
- `probe-webarena-shopping-reset-gate.mjs` separates Docker restart errors from
  transient health-probe errors and allows a 120-second cold-start window.
- Neither gate authorizes a study arm. Failures remain classified as
  `infrastructure-gate-failed`, never as CUA, Hybrid, Traditional, task, or
  oracle outcomes.
