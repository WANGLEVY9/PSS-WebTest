# PrestaShop parallel diagnostic batch r4--r8 (2026-09-10)

This batch extends the single-workflow diagnostic only. It is not confirmatory evidence and does not freeze repetition counts or admit PrestaShop.

## Scope and controls

- Application: local PrestaShop 8, authenticated buyer search workflow.
- Query: `Mug`; visible target: `Mug The Adventure Begins`.
- Common scripted authentication preamble; credentials were not sent to the provider.
- Independent database oracle was run for every repetition and passed every time.
- Each run received a unique run id and wrote a separate local replay/run-record artifact.

## Results

| Arm/configuration | Runs | Passed | Actions | Wall time (ms) | Oracle |
|---|---:|---:|---:|---:|---|
| Hybrid semantic target-id + Qwen3.7-Flash | r4, r5, r6 | 3/3 | 3 each | 14,961; 11,136; 9,135 | 3/3 |
| Accessibility-locator Playwright | r6, r7, r8 | 3/3 | 3 each | 1,131; 1,338; 1,009 | 3/3 |

Hybrid r4 required one provider retry but still completed; r5 and r6 completed without retries. The three Hybrid traces selected the same semantic target id (`c9`), typed `Mug`, and pressed Enter.

## Boundary

This is repeated feasibility evidence for one clean workflow, one application, one provider/model, and one hybrid action mode. Pure visual remains unresolved, coordinate Hybrid remains unresolved, and no fault/evolution arm was run in this batch. Therefore the batch is useful for debugging and variance planning only; it is not a three-arm matched estimate.
