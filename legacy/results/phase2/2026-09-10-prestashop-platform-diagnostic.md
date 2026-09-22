# PrestaShop expansion diagnostic (2026-09-10)

## Evidence captured

- Candidate SUT: PrestaShop from the local WebTestPilot compose, seed, and buyer/seller task fixtures.
- The project lifecycle adapter correctly performed the volume/network reset and built the local image.
- Startup was rejected by Docker because the locally built `prestashop-app:latest` was `arm64/linux`, while the compose service declares `linux/amd64`.
- An explicit `docker build --platform linux/amd64` retry was also blocked by the installed legacy Docker builder, which continued to use the ARM base layers and failed at the platform handoff.

## Classification

This is an **infrastructure/platform boundary**, not a CUA, Hybrid, Playwright, or oracle result. No PrestaShop task was executed and no run was added to any empirical denominator. The candidate remains `candidate-unverified`.

## Required remediation before admission

1. Install/enable a BuildKit/buildx builder or use a native amd64 execution host.
2. Build and record a digest-pinned `linux/amd64` PrestaShop image.
3. Re-run reset and seed verification, then implement the independent cart/order oracle.
4. Only after that run the matched Playwright, pure-visual, and Hybrid pilot.
