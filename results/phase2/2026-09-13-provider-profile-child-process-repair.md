# Phase 2 provider-profile child-process repair

## Scope

This tranche audits the DeepSeek Indico and Juice Shop cells that previously
returned HTTP 404 `model-not-exist`. The official DeepSeek API smoke test with
the configured `deepseek-v4-flash-vision-exp` identifier returned HTTP 200, so
the earlier cells were not valid capability observations. The matched
controllers were loading `.env` in the parent process but did not inject the
selected provider profile into their child agent processes.

## Engineering change

`code/scripts/indico-matched-pilot.mjs` and
`code/scripts/juice-shop-matched-pilot.mjs` now:

1. read the selected local profile (`.env.deepseek` or `.env.volcengine-cua`);
2. preserve only genuinely explicit command-line overrides;
3. pass the resolved provider, model, base URL, and API key profile to every
   Playwright/agent child process; and
4. set `PSS_REQUIRE_FROZEN_PROFILE=1` in the child environment.

This prevents the previous failure mode where `CUA_PROVIDER=deepseek` was
paired with the Aliyun base URL/key inherited from `.env`.

## Validity evidence

The post-fix controllers were first executed with one matched repetition per
application and then extended with two additional matched repetitions for each
application. All runs used the same reset/oracle contract as the preceding
pilots.

| Application/task | Playwright | Pure visual | Hybrid | Validity |
|---|---:|---:|---:|---|
| Indico create-event / DeepSeek | 3/3 | 0/3, grounding-loop | 0/3, oracle failure after pass verdict | valid pilot stratum |
| Juice Shop product-search / DeepSeek | 3/3 | 0/3, grounding-loop | 3/3 | valid pilot stratum |

The pre-fix 404 records remain in the append-only artifact history but are
labelled invalid configuration evidence and are excluded from capability
aggregates. They must not be pooled with the post-fix grounding/oracle
outcomes.

Artifacts:

- `artifacts/phase2/indico-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-indico-clean-deepseek-provider-profile-fix2-pilot.json`
- `artifacts/phase2/juice-shop-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-juice-clean-deepseek-provider-profile-fix2-pilot.json`
- `artifacts/phase2/indico-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-indico-deepseek-rep2-pilot.json`
- `artifacts/phase2/juice-shop-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-t1-juice-deepseek-rep2-pilot.json`

Descriptive variance and planning outputs (not frozen sample-size decisions):

- `results/phase2/2026-09-13-indico-deepseek-clean-variance.json`
- `results/phase2/2026-09-13-juice-deepseek-clean-variance.json`
- `results/phase2/2026-09-13-indico-deepseek-power-planning.json`
- `results/phase2/2026-09-13-juice-deepseek-power-planning.json`

## Interpretation boundary

This is diagnostic pilot evidence only. It establishes that DeepSeek requests
can reach the intended endpoint in these controllers and separates provider
configuration failure from model/SUT behavior. It does not admit either
application, freeze repetition counts, or authorize confirmatory collection.
Both applications still require complete workflow/condition coverage and
repetition variance before admission.
