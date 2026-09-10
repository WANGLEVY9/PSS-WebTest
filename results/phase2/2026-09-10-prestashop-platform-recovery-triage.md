# PrestaShop platform recovery triage (2026-09-10)

## Scope

This is an infrastructure-only diagnostic. No Playwright, pure-visual, Hybrid, fault, evolution, oracle, or confirmatory run was executed.

## Reproduction and evidence

The local host is Apple Silicon (`arm64`). Colima was initially stopped, then started successfully with the Docker runtime. Docker reported `linux/arm64`; the Docker CLI initially had no Buildx plugin.

The existing WebTestPilot PrestaShop compose definition hard-coded `platform: linux/x86_64` for both the app and MySQL services. The existing local `prestashop/prestashop:8` and `prestashop-app:latest` images were `arm64/linux`, which explains the earlier platform mismatch during startup.

The following reversible environment repair was applied locally:

1. Installed Homebrew `docker-buildx` 0.37.0 and registered it in the per-user Docker CLI plugin directory.
2. Registered/checked the Colima Rosetta emulator (`linux/amd64` was not listed as a native BuildKit worker platform, but Rosetta was available).
3. Built a temporary `linux/amd64` image with Buildx from `third_party/WebTestPilot/webapps/prestashop`; build completed successfully and Docker inspected it as `amd64/linux`.
4. Ran the project reset once with the hard-coded x86 platform. The app and MySQL containers started and PrestaShop installation completed, but the readiness gate did not complete: the app repeatedly returned HTTP `302` from `/`, redirecting to `http://localhost:8083/`; Apache workers subsequently emitted `Segmentation fault (11)` under Rosetta. No seed snapshot was produced.
5. Removed the hard-coded platform lines from the local ignored WebTestPilot compose copy so a future run can use native `arm64` images. This local third-party tree is ignored/not tracked by the public repository, so the change is not yet a publishable repository patch.

## Gate status

**PrestaShop reset/ready/seed gate: NOT PASSED.**

The architecture mismatch was mitigated for local construction, but the only tested cross-architecture runtime remained unstable under Rosetta. The native-arm compose change still needs one bounded reset verification; it must not be treated as successful until the HTTP ready marker and numeric seed snapshot are both captured.

## Recommended next bounded action

Run exactly one native-arm reset after confirming the local compose copy has no `platform` overrides. Capture:

- `docker image inspect prestashop-app:latest` architecture/OS and digest;
- `docker ps` status for both services;
- one HTTP ready response;
- the lifecycle seed snapshot counts;
- app logs if any readiness failure occurs.

If native-arm reset passes, pin the resulting app/database image digests in the local benchmark manifest and implement the independent relational oracle before any matched pilot. If it fails, keep PrestaShop `candidate-unverified` and move to another candidate application; do not record the failure as an agent result.

