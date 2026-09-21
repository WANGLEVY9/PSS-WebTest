# Pre-collection engineering checks — 2026-09-21

**Collection remains paused.** These checks add zero benchmark executions, zero model requests and no confirmatory evidence. They do not amend the human-confirmed design or replace independent task screening. All observed failures remain recorded.

## Results

| Component | Evidence obtained | Limit |
|---|---|---|
| WebArena-Verified evaluator | Original selected suite: 438 passed, 3 upstream skips; all 74 installed Python source files match the pinned source | Not the full official test suite or all task/evaluator semantics |
| WAV null-schema boundary | Four synthetic responses to exposed development task 22: empty array gives ordinary success/failure; nonempty wrong answer yields native error | Answer-dependent error is not automatically external infrastructure; no evaluator/gold/answer patch |
| VWA runtime | Separate Python 3.11.15; official fixed requirements, Playwright 1.37.0 and Chromium 116.0.5845.82 installed | VQA/BLIP and LLM judges have not been run |
| VWA components | Nine synthetic exact/numeric/image/actuator checks passed | No actual VWA task execution or site admission |
| VWA native action tests | Both selected upstream tests failed: CLEAR equality and missing public constructor export; zero-coordinate constructor issue also reproduced | Failures are preserved, not skipped or patched away |
| ATA parser | Bundled official parser and PSS agree for all six CSVs: 113 candidates; titles, action/assertion steps, labels and failure-step extraction match | Frozen inventory remains 112 pending versioned adjudication; duplicate source indices unresolved |
| ATA formulas | 216 synthetic valid-verdict fixtures, 1,359 defined metric comparisons, zero mismatches against original formula AST | 153 undefined-rate cases: PSS null vs native zero explicitly retained; missing/invalid outputs not claimed equivalent |

The ATA check executes only the extracted arithmetic assignments from the original evaluator AST; calls, imports, loops and awaits are rejected. It never imports the remote-reset runner. Parser import disables dotenv loading. VWA's deterministic evaluator imports instantiate OpenAI; its component check uses an invalid placeholder and a closed localhost port, not a real credential.

### Dependency caveat

VWA's official torch 2.0.1 ARM64 binary imports and performs CPU tensor arithmetic, but its wheel metadata declares x86_64. `uv pip check` therefore reports a platform mismatch. The binary was independently inspected as Mach-O arm64. We have not edited metadata, upgraded the official torch pin, or claimed working BLIP inference. WAV's separate environment dependency check passes.

## Environment failures and repairs

### VWA: capacity, not just timeout

Registry inspection of the official compose reference `jykoh/classifieds:latest` resolved digest `sha256:a2a794da92f62a8d7ffd02314e4fab40ba6c7fc08f568371608f88f0ef605e43` (linux/amd64). Its compressed layers total **76,861,304,894 bytes**; the largest layer alone is 76,642,798,711 bytes. The dedicated Colima VM has a roughly 60 GB disk and only **10,062,282,752 bytes** available at the capacity probe. Host free disk is not VM free disk.

The prior 30-minute pull ended with ETIMEDOUT after approximately 14.21 GB downloaded. Merely extending time cannot solve a disk smaller than the compressed image. New `vwa-capacity-preflight.mjs` refuses a pull on insufficient/unknown VM capacity. Its 2x compressed-size reserve is an engineering policy, not a measured unpacked-size guarantee. `compose up` uses `--pull never`, so it cannot bypass this check. No prune, image substitution, VM resize or cloud provisioning was performed. The deployment route requires a resource decision; the task denominator is unchanged.

### WAV: isolated reset not yet passed

Four attempts are retained separately:

1. Database export exceeded the host buffer. Fixed by hashing ordered review-table dump contents in-container with `pipefail`.
2. Fresh clone did not serve the homepage within the warmup timeout. Concurrent native/explicit initialization was removed.
3. A one-shot `supervisorctl` EXITED state returned code 3 and was incorrectly treated as command failure. Interrupted after diagnosis; fixed with regression coverage.
4. Corrected native-init observation passed, but HTTP/origin readiness still failed after bounded warmup. Zero full reset cycles completed.

The fourth clone's native initializer took about seven minutes in x86 QEMU on the ARM host. Logs show PHP-FPM reaching its five-worker limit; slow emulation and repeated timed-out warmup requests are plausible contributors, not a proven single cause. Docker reports OOMKilled=false. The final exit 137 followed our stop operation; it is **not evidence of OOM**. The original experiment container was not reset; no controlled task mutation was reached. Stopped disposable clones were retained for diagnosis.

The legacy cardinality/schema probe now always leaves `state_reset_verified=false`: equal table cardinalities do not prove restored row contents. Its former repeatability result is retained under `cardinality_repeatability_verified`. The new probe checks owned labels, pinned image and absence of mounts before any disposable lifecycle action. It uses its own loopback ports, not the original instance's ports.

## Readiness and next decisions

1. Select a sufficiently provisioned native x86 host or explicitly enlarge the dedicated local VM before any further VWA download; estimate unpacked/runtime disk as well as compressed size.
2. Diagnose isolated WAV HTTP serving with per-attempt status/error/origin and service timing; avoid treating client timeout as canceled server-side PHP work. Then complete three controlled mutation/reset/content-restoration cycles with neighbor isolation checks.
3. Resolve VWA native action-library defects and action-set policy as a versioned adapter decision; native scroll is viewport-sized JS scrolling, not identical to the PSS wheel-delta interface. Do not silently interchange them.
4. Human-confirm the ATA population amendment and source-step treatment, then verify local fixture-label and reset equivalence.
5. Complete task screening, blinded Traditional authoring, live information-boundary audits and protocol/statistical freezes before formal authorization. A method can fail legitimately; passing tasks is not an admission criterion.

## Reproducibility

Final regression verification: 35/35 local-lab Node tests, 287/287 contract tests and 3/3 ATA preparation Python tests passed. Historical benchmark ledger validation found five batches, 33 records and zero schema errors. Browser verification found no page errors, seven evidence/gate disclosure panels, and the collection button disabled. These are software checks, not additional benchmark samples.

Scripts: `runtime-provenance.py`, `wav-evaluator-preflight.py`, `vwa-native-preflight.py`, `ata-native-parser-preflight.py`, `ata-metric-preflight.py`, `wav-reset-preflight.mjs`, `vwa-capacity-preflight.mjs`.

Private raw JUnit/runtime/reset artifacts remain under `code/artifacts/local-runtime`. `preflight-summary.py` exports only engineering aggregates and evidence SHA-256 hashes to `results/local-runtime/2026-09-21-preflight-summary.json`. The console shows component evidence separately from open admission gates.
