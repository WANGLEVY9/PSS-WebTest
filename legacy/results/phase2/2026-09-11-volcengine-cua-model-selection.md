# Volcengine CUA/HybridAgent model selection

Date: 2026-09-11
Evidence class: provider capability screening; no study cell is admitted.

## Selection

The account-visible Ark model list contains several generative multimodal
families. The selected candidate is:

- `doubao-seed-2-1-pro-260628`
- expected use: screenshot-only visual CUA and screenshot+page-structure hybrid
- API route: `https://ark.cn-beijing.volces.com/api/v3`
- local profile: `code/.env.volcengine-cua`

It is preferred over the embedding model because the Seed family is a
generative multimodal family; the embedding model only produces vectors and
cannot emit UI actions. The 2.1 Pro model is registered as a diagnostic
candidate, not as admitted evidence.

## Capability screening

An initial request returned HTTP 404 `ModelNotOpen`, but a retry using the
console's exact Responses API example subsequently returned HTTP 200. The
project's actual visual driver then completed a bounded click decision from a
Playwright-generated screenshot, and the hybrid driver completed a bounded
semantic click from the same screenshot plus declared page structure.

The reproducible provider smoke reported:

```json
{"visual":{"status":"ok","decision_type":"action","action_type":"click"},"hybrid":{"status":"ok","decision_type":"action","action_type":"click","target_id":"c1"}}
```

These are provider/adapter connectivity smokes only. They do not establish
BookStack task success or matched-pilot admission. The embedding probe remains
separate and is not used as a CUA model.

## Required console action

If the console later supplies a dedicated **在线推理接入点** ID, set that ID
as `CUA_MODEL` in the ignored profile and rerun the same smoke. The current
prebuilt model ID is already working. Do not start matched pilot collection
until the SUT reset gate, independent oracle, and three-arm admission checks
also pass.

The profile and registry changes remain fail-closed: provider connectivity is
verified, but no SUT task or matched-pilot evidence is admitted yet.
