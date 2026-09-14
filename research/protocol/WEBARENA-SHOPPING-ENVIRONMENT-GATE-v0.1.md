# WebArena-Verified Shopping environment gate v0.1

Date: 2026-09-14

Status: **failed infrastructure gate; no study arm was launched**

The digest-pinned candidate image
`am1n3e/webarena-verified-shopping@sha256:3e8cb9b945ea9b1c94ab26dba53e8d12dd0406abbf4bf686fd3bb2b6a5908feb`
was started on the local Colima Docker runtime. The observed image ID exactly
matched that digest.

The environment is nevertheless not admissible:

- host and Colima server are `arm64`/`aarch64`, while the downloaded image is
  `amd64`;
- the controller's `/status` response reported `php-fpm: FATAL`;
- the storefront returned HTTP `502 Bad Gateway`;
- container logs showed repeated `php-fpm` `SIGSEGV` exits.

This is classified as `infrastructure-gate-failed`, not a CUA, Hybrid,
Traditional, task, oracle, or benchmark result. The architecture/emulation
relationship is a plausible diagnosis, not yet a proven root cause. The next
valid remediation is an image/runtime combination that passes the same
digest-pinned health and reset gate; changing method parameters would be an
invalid response to this failure.

## Follow-up probe

The strengthened gate now records the architecture fields explicitly:

```text
host_architecture=aarch64
image_architecture=amd64
architecture_compatible=false
image_matches=true
ready=false
```

An isolated `webarena-x86` Colima profile was attempted with the native
Virtualization.Framework backend, but Colima reported that `qemu-img` is not
installed and refused to create the x86_64 VM. The default arm64 profile and
the stopped candidate container were left unchanged. No fallback emulation,
task execution, or provider request was attempted.
