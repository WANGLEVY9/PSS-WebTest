# Fresh-image reset cycles — 2026-09-21

**Result: three scoped reset cycles passed; benchmark execution remains blocked.**

Run `wav-reset-preflight-1789991751682` took 22 minutes 40 seconds on local x86 QEMU. It created a fresh baseline and three subsequent fresh containers from the pinned WAV Shopping image. No model requests or benchmark task outcomes were generated.

| Cycle | Controlled title mutation detected | Six-table content fingerprint restored | Neighbor instance identity/content unchanged | Homepage HTTP |
|---|---|---|---|---|
| 1 | yes | yes | yes | 200 |
| 2 | yes | yes | yes | 200 |
| 3 | yes | yes | yes | 200 |

All restored content fingerprints equal `241a0c1fcebe1160e43af087e93f1c4fb8e4d9ba63391c0dc0545f0a62d1a460`. Three mutation fingerprints are distinct from that baseline. Every cycle used a new container identity. The final clone is stopped and retained. An independent structural audit verifies cycle order, identity continuity/uniqueness, mutation/restoration, neighbor isolation, final cleanup and the captured executable's SHA-256.

The covered tables are `review`, `review_detail`, `review_store`, `rating_option_vote`, `rating_option_vote_aggregated` and `review_entity_summary`. The controlled intervention is an existing review-title change, repeated with distinct markers. This is reproducibility evidence for that scoped reset, **not** coverage of all possible inserts, deletions, accounts, files, search indexes or task dependencies.

## Startup findings

After waiting for official service health, the four initial homepage requests took 54.924, 58.657, 50.792 and 48.252 seconds. Each exceeded the former 20-second warmup limit. This strengthens the engineering explanation for earlier admission failures. Provisioning latency is not agent latency, and no agent budget or observation was expanded. Native health reports and evaluator correctness remain separate requirements.

Disk pressure reached 91% during the run; the first observed Elasticsearch cluster had six active primary shards and yellow status with an unassigned replica. We did not disable disk watermarks or treat controller HTTP availability as proof of all task-level search behavior.

After the terminal reset evidence was saved, three explicitly owned, stopped, mount-free old diagnostic clones were retired. Their inspect metadata and captured Docker-log stdout are archived privately; stderr completeness is not claimed. Writable layers were deleted and cannot be restored from the log archive, although fresh instances can be recreated from the fixed image. The main experiment container and this run's final clone were retained. VM disk usage fell to 74%, with approximately 15.97 GB available. This still does not satisfy VWA image capacity requirements.

## What is still required

1. Bind the reset recipe and fingerprints to the exact dependencies of the selected development tasks; do not infer full benchmark admission from six review tables.
2. Implement reset before **each arm/repetition** in the actual runner. Its reset capability intentionally remains false; no flag was flipped for this result.
3. Verify task-specific native evaluator contracts and dynamic information boundaries, then allow a bounded matched diagnostic run on already exposed development tasks.
4. Keep formal eligibility, blinded Traditional adaptation, frozen protocols and statistical design as independent confirmatory gates. VWA and ATA remain unadmitted.

The English console now exposes live reset phase/cycle count and scoped verification separately from task execution. Regression: 43 local Node tests, 287 contract tests and three ATA preparation tests passed. Historical experiment ledger: five batches / 33 records, no validation errors.

Public evidence: `results/local-runtime/2026-09-21-reset-cycles.json`. Raw observations and the actual executed source remain under ignored `code/artifacts/local-runtime`.
