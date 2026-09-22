# Juice Shop clean product-search pilot — 2026-09-13

Evidence boundary: one matched repetition per model stratum; pilot only.

Task: search the catalog for the seeded `Apple` product and satisfy the
independent visible/database oracle. The reset contract and digest were
verified before each arm.

| Model stratum | Playwright | Pure visual | Hybrid |
|---|---:|---:|---:|
| Qwen3.7-Flash | 1/1 | 0/1 | 0/1 |
| DeepSeek V4.1-Flash | 1/1 | blocked (404) | blocked (404) |

Qwen Pure visual stopped at a repeated non-progressing click; Qwen Hybrid
completed its action protocol but the independent UI oracle did not pass.
These are agent/grounding and oracle-boundary failures, not SUT reset failures.

The DeepSeek visual and Hybrid runs both received HTTP 404 `Model not exist`
from the configured endpoint before any browser action. They are recorded as
`provider-api` and excluded from model-capability pooling until the endpoint
model identifier is corrected; they are not evidence that DeepSeek cannot
perform the task.

Playwright passed in both strata. This pilot is not an application-admission
or confirmatory result.
