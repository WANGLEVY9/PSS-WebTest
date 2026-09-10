# Traditional Playwright 500-run batch (2026-09-10)

This is a traditional-arm reliability and load diagnostic. It is not a three-arm matched comparison, a repetition-freeze decision, or a confirmatory superiority result.

## Fixed protocol

- Application: local PrestaShop 8, seeded with counts `[3,19,5,6]`.
- Fresh browser context per execution.
- Independent database oracle per execution, requiring the seeded product `Mug The adventure begins`.
- Fixed distribution: 200 simple, 175 medium, 125 complex executions.
- Workflows are read-only at the application level; the post-batch counts remained `[3,19,5,6]`.
- Raw run-records and replays remain local under ignored `artifacts/phase2/`.

## High-concurrency batch

The first 500-run batch used eight concurrent workers.

| Complexity | Planned | Completed | Failures | Script/oracle passes among completed | Observed rate |
|---|---:|---:|---:|---:|---:|
| Simple | 200 | 174 | 26 | 174/174 | 87.0% |
| Medium | 175 | 147 | 28 | 147/147 | 84.0% |
| Complex | 125 | 105 | 20 | 105/105 | 84.0% |
| **Total** | **500** | **426** | **74** | **426/426** | **85.2%** |

All 74 failures were execution-timeout boundaries: 66 login-page timeouts, 4 search-input timeouts, 2 search-result timeouts, and 2 product-detail timeouts. The independent oracle passed for every completed run; no oracle disagreement was observed. After the run the SUT returned HTTP 500 and required a reset.

Approximate Wilson 95% intervals for the observed high-concurrency completion rates are 81.6--91.0% (simple), 77.8--88.7% (medium), and 76.6--89.4% (complex). These intervals describe this load condition, not intrinsic Playwright capability.

## Low-concurrency recovery probe

After a native reset, a separately tagged 60-run recovery used two workers:

| Complexity | Planned | Completed | Failures | Oracle passes |
|---|---:|---:|---:|---:|
| Simple | 24 | 24 | 0 | 24 |
| Medium | 21 | 21 | 0 | 21 |
| Complex | 15 | 15 | 0 | 15 |
| **Total** | **60** | **60** | **0** | **60** |

The post-recovery database counts remained `[3,19,5,6]`. This low-load result is a diagnostic control, not a post-hoc replacement for the 500-run batch.

## Interpretation and next step

Traditional locator scripts and their independent oracle were deterministic in the stable low-load control. The high-concurrency failures expose a SUT capacity/availability confound: increasing worker concurrency can reduce apparent test success even when the script is correct. Before using traditional results as a baseline for CUA/Hybrid, the study must freeze a concurrency policy (or model concurrency as an explicit factor), add a readiness/HTTP-500 health gate, and collect matched runs under the same load condition.
