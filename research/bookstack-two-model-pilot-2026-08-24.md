# Two-model CUA pilot (2026-08-24)

## Provider profiles

The restored local profiles are:

- `aliyun / qwen3-vl-flash`, using the existing Alibaba-compatible endpoint;
- `volcengine / doubao-seed-2-0-pro-260215`, using the Ark endpoint.

The API credentials are stored only in ignored local environment files. They
are not present in the repository, artifacts, or this report.

Both providers passed the real image-input connectivity gate on the running
BookStack login page. For each provider, both the screenshot-only visual driver
and the screenshot-plus-allowlisted-pageStructure hybrid driver returned a
valid bounded UI action. This is provider readiness evidence, not a task
success result.

## Matched clean pilot

The same SUT version, seed, task intent, viewport, arms, reset policy, and
budget were used for one repetition per model. Artifacts are separated by
model slug.

| Model | Task | Playwright | Pure visual | Hybrid | Matched repetition |
|---|---|---:|---:|---:|---:|
| Qwen3-VL-Flash | BookStack navigation | 1/1 | 1/1 | 1/1 | no, create-page cell failed |
| Doubao Seed 2.0 Pro | BookStack navigation | 1/1 | 1/1 | 1/1 | yes |
| Qwen3-VL-Flash | BookStack create-page | 1/1 | 0/1 | 1/1 | no |
| Doubao Seed 2.0 Pro | BookStack create-page | 1/1 | 1/1 | 1/1 | yes |

All reset attempts passed and each successful cell had an independent visible/
persisted-state oracle pass. The Qwen visual create-page failure was an
execution failure caused by a repeated non-progressing click. The single
Doubao success must not be interpreted as evidence of superiority because
`n=1` and the task has not passed the multi-repetition admission gate.

## Interpretation

The second model is now a real model stratum rather than a mocked adapter. The
pilot suggests a useful follow-up contrast: the navigation task is easy for
both models, whereas the rich-text persistence task exposes model/provider and
grounding variance. This directly supports the study objective of identifying
conditions under which visual, hybrid, and locator-based testing succeed or
fail, rather than asserting a universal winner.

No repetition number is frozen, no power simulation is treated as final, and no
Indico/Juice Shop confirmatory run is started. The next gate is repeated
create-page pilot collection for both model profiles, followed by fault and UI
evolution conditions with the same model-stratum separation.
