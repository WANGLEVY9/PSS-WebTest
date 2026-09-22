# Explicit VWA Classifieds provisioning

This is environment provisioning, not benchmark admission. No official task or model request is executed by these commands. The old `node local-lab/prepare-vwa.mjs pull` interface is intentionally rejected.

## Prerequisites

1. Keep the pinned official source checkout clean. Store the downloaded `classifieds_docker_compose` fixture outside `artifacts/benchmark-snapshots/`.
2. Before moving existing files, recheck open files and Docker bind mounts. Preserve every byte; retain a private old/new path and SHA256 receipt. Do not delete or conceal the fixture with `.gitignore`.
3. Create a reviewed private provisioning JSON with the schema below. All filesystem paths are absolute and the output directory must already exist. The four fixture files must match the complete manifest, with no symlinks or extra initialization SQL.
4. Select the actual Docker context explicitly. The daemon must be Linux amd64. The web and database images must use **single-platform Linux amd64 manifest digests**, not mutable tags or multi-platform index digests.
5. The credentials file must be mode `0600` and contain only `PSS_VWA_CLASSIFIEDS_RESET_TOKEN=<16+ safe characters>` and `PSS_VWA_DB_PASSWORD=<fixture-compatible password>`. Supported values contain only letters, digits, `_`, `.`, `-`; arbitrary dotenv directives and inherited provider keys are not accepted or forwarded.

## Profile fields

```json
{
  "schema": "pss-vwa-provision-v1",
  "docker_context": "EXPLICIT_CONTEXT_NAME",
  "project_name": "pss-vwa-sponsored",
  "fixture_root": "/ABSOLUTE/PRIVATE/FIXTURE_ROOT",
  "fixture_files": {
    "docker-compose.yml": "REVIEWED_SHA256",
    "mysql/classifieds_restore.sql": "REVIEWED_SHA256",
    "mysql/init_db.sh": "REVIEWED_SHA256",
    "mysql/osclass_craigslist.sql": "REVIEWED_SHA256"
  },
  "images": {
    "web": "jykoh/classifieds@sha256:REVIEWED_LINUX_AMD64_MANIFEST_DIGEST",
    "db": "mysql@sha256:REVIEWED_LINUX_AMD64_MANIFEST_DIGEST"
  },
  "credentials_file": "/ABSOLUTE/PRIVATE/vwa-runtime.env",
  "output_dir": "/ABSOLUTE/PRIVATE/PROVISIONING_RECEIPTS",
  "required_free_bytes": 200000000000
}
```

These placeholders are not runnable. The reserve is an operator provisioning choice, not a published benchmark requirement. The runtime additionally requires at least `2 * sum(compressed image layers) + 5 GiB` free in the actual Docker storage filesystem. This is a conservative engineering estimate, not proof of final unpacked/runtime sufficiency.

## Commands (from `code/`)

```bash
node local-lab/prepare-vwa.mjs config --profile /ABSOLUTE/PRIVATE/vwa-provision.json
node local-lab/prepare-vwa.mjs pull --profile /ABSOLUTE/PRIVATE/vwa-provision.json
node local-lab/prepare-vwa.mjs up --profile /ABSOLUTE/PRIVATE/vwa-provision.json
node local-lab/prepare-vwa.mjs ps --profile /ABSOLUTE/PRIVATE/vwa-provision.json
node scripts/probe-visualwebarena-local-assets.mjs --fixture-profile /ABSOLUTE/PRIVATE/vwa-provision.json
```

Every valid-profile attempt gets a new private receipt; process logs are separate, mode `0600`, never dumped to public stdout. `up` does not pull or build images implicitly. It checks that exact digest images already exist and are Linux amd64. Failures and earlier receipts are never overwritten.

`pull` currently supports only a native Linux x86_64 host with a local Unix-socket daemon whose `DockerRootDir` filesystem can actually be measured. A macOS host's free space does not prove capacity inside Colima. Remote/VM adapters remain blocked until a separately tested measurement implementation is supplied; no hard-coded Colima fallback is retained.

After provisioning, native reset, isolation, evaluator controls and task-level/framework acceptance remain mandatory. Successful `config`, `pull`, or `up` never authorizes confirmatory collection.

## Regression checks

```bash
node --test local-lab/vwa-fixture-config.test.mjs local-lab/provisioning-contract.test.mjs local-lab/sponsor-portable-config.test.mjs tests/contracts/visualwebarena-local-assets.test.mjs
```

Verified this round: **30 tests passed, 0 failed, 0 skipped**. This includes synthetic config/hash/tampering, credential-file restrictions, explicit context, digest mismatch, unknown storage, insufficient capacity, error redaction and refusal of the legacy no-profile CLI. These are not live Docker provisioning or benchmark-success evidence.

## Existing callers needing documentation alignment

- `local-lab/EXPANSION-PLAN.md` contains the superseded no-profile commands.
- `scripts/probe-visualwebarena-local-assets.mjs` now requires the same explicit profile, checks fixture hashes and selected-context image digests, and never searches source-internal fixture paths. It deliberately keeps `ready_for_service_start=false` and `study_execution_allowed=false`: an inventory does not establish full immutable provenance for Shopping/Reddit, reset or evaluator admission. Exit zero means this inventory check completed with its declared assets present, not scientific admission.
- The sponsor offline verifier automatically discovers `local-lab/*.test.mjs`, including the new test suite.

## Torch platform diagnosis

The current macOS ARM64 VWA environment contains native ARM64 torch binaries and passed a simple CPU import/operation check. However, the **official PyPI torch 2.0.1 ARM64 wheel itself** contains an x86_64 WHEEL tag. Its downloaded SHA256 matched PyPI. Reinstalling that identical wheel cannot repair the metadata discrepancy. Preserve the `uv pip check` failure and the evidence; do not edit WHEEL manually or globally waive architecture checks. The sponsor Linux environment must be built afresh with independently verified exact dependencies and native evaluator acceptance.

Verified artifact:

- File: `torch-2.0.1-cp311-none-macosx_11_0_arm64.whl`
- Size: `55,831,241` bytes
- SHA256: `25aa43ca80dcdf32f13da04c503ec7afdf8e77e3a0183dd85cd3e53b2842e527`
- ZIP member `torch-2.0.1.dist-info/WHEEL`: `Tag: cp311-cp311-macosx_11_0_x86_64`
- [Official PyPI release](https://pypi.org/project/torch/2.0.1/) and [machine-readable release metadata](https://pypi.org/pypi/torch/2.0.1/json).
- [Exact official wheel](https://files.pythonhosted.org/packages/85/68/f901437d3e3ef6fe97adb1f372479626d994185b8fa06803f5bdf3bb90fd/torch-2.0.1-cp311-none-macosx_11_0_arm64.whl).

The evidence report `pss-env-audit-20260922.json` includes the read-only commands' observed platform, runtime smoke, download digest comparison and fixture/log preservation manifest. Preserve it with private acceptance artifacts. Rebuilding the sponsor Linux environment remains necessary; this diagnosis is not an exception that makes the dependency gate pass.
