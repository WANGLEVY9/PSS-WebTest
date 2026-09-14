# Benchmark artifact freeze log v1.0

Date: 2026-09-14
Status: **source pins and local source inventories recorded; local reproduction and benchmark admission pending**

Machine manifest: `code/config/benchmark-artifact-manifest.v1.0.json`

This log records read-only source evidence. It is not a claim that any task,
environment, evaluator, or benchmark is admitted to confirmatory collection.

| Benchmark | Pinned source | License evidence | Current gate state |
|---|---|---|---|
| WebArena-Verified | `6473f72db5dcefc97b5725b59e734504edc28a21` | Apache-2.0 source `LICENSE` | 812 source records fingerprinted; screening, local environment, evaluator semantics, and three-reset gate pending |
| VisualWebArena | `89f5af29305c3d1e9f97ce4421462060a70c9a03` | MIT source `LICENSE` | 910 source records fingerprinted across three VWA files; screening, local environment, evaluator semantics, and three-reset gate pending |
| Autonomous Tester Agent Benchmark / PinATA | `650b9edaa055915cb27d2498f379a66430cc3e02`; Zenodo `10.5281/zenodo.15198569` | Zenodo record CC-BY-4.0; repository has no root `LICENSE` at this pin | 112 test cases fingerprinted; Zenodo MD5 verified; evaluator-semantics audit, local environment, and reset gate pending |
| WorkArena++ | `a772230a94cf1caf4166b8ead3983f3b3786455b` | Apache-2.0 source `LICENSE` | Conditional extension; instance access, credentials, evaluator compatibility, and reset gate not started |

## Evidence observed

- WebArena-Verified README at the pinned commit describes version-controlled
  tasks, deterministic evaluation based on agent response and captured network
  trace, and controlled environments.
- VisualWebArena README at the pinned commit describes benchmark-provided
  environments and reset prerequisites; these must be reproduced locally.
- The ATA Zenodo record lists `ISSTA_ARTEFACT.zip` with declared checksum
  `md5:ba9931778e25bac80bda02f3a9c2e61f`. The downloaded archive matches this
  MD5; its additional SHA-256 fingerprint is
  `c0b0a21f3ca5871f8c6db59e7d015e04350c577aef8714091e40246dc8fcb3bf`.
  Its six benchmark CSVs contain 112 test-case delimiters (not 1,650 source
  lines), so the source-line total is not used as a task count.
- The source inventories and evaluator source fingerprints are captured in the
  machine manifest. They are **not** eligible task sets: no filtering,
  adaptation, arm execution, or evaluator outcome has been performed.
- Source-level ATA audit found that `evaluation.py` resets a remote public
  service through GitHub Actions and takes `execution_result.status` from the
  benchmark Actor/Assertor orchestration. It therefore remains blocked pending
  a protocol decision on whether its unchanged endpoint can be a shared,
  method-independent oracle. See `EVALUATOR-SEMANTICS-AUDIT-v0.1.md`.

## Next mandatory evidence

1. reproduce each core environment locally;
2. export official task inventories without invoking any study arm;
3. hash task and evaluator artifacts;
4. perform three reset/evaluator cycles for each candidate benchmark;
5. record any credential, license, evaluator, or reset failure with the
   pre-registered exclusion code rather than silently skipping it.
