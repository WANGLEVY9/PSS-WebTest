# Provider configuration and bounded connectivity check

Date: 2026-09-11
Evidence class: configuration/diagnostic only; no study cell is admitted.

## DeepSeek visual CUA profile

- Local ignored profile: `code/.env.deepseek`
- Provider: `deepseek`
- Vision model requested by the profile: `deepseek-v4-flash-vision-exp`
- Base URL: `https://api.deepseek.com`
- Action protocol: tool call
- Bounded probe: HTTP 200, image input accepted, non-empty choice returned.
- The API response canonicalized the returned model label to `deepseek-flash`; the request profile retains the documented vision model identifier.

The BookStack visual/hybrid smoke was not run to completion because the local SUT at
`127.0.0.1:8081` was unreachable. This is an infrastructure boundary, not a provider
failure, and no BookStack result is admitted from this check.

## Volcengine embedding profile

- Local ignored profile: `code/.env.volcengine-embedding`
- Model: `doubao-embedding-vision-251215`
- Base URL: `https://ark.cn-beijing.volces.com/api/v3`
- Role: multimodal embedding/retrieval only; not a CUA action-generation model.
- Text-only probe: HTTP 404 `ModelNotOpen`; no screenshot was uploaded.

The key is configured locally but the account/endpoint is not currently open for this
model on the tested API route. The result must be resolved in the Ark console (model
authorization/endpoint selection) before using this profile for retrieval experiments.

## Reproducible checks

```sh
set -a; source code/.env.deepseek; set +a
node --input-type=module -e '/* bounded vision probe used in the run log */'

set -a; source code/.env.volcengine-embedding; set +a
cd code && npm run provider:volcengine:embedding
```

No credential value is tracked in Git. The two profiles are excluded by `.gitignore`.
