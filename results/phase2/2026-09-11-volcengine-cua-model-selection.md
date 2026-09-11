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

The existing Ark key was tested against the selected model with a minimal
image request and against a small set of account-visible generative models with
text-only requests. The selected model returned HTTP 404 `ModelNotOpen`. The
other tested candidates likewise returned `ModelNotOpen` or
`InvalidEndpointOrModel.NotFound`.

This means the API key can enumerate model metadata but currently has no usable
online-inference access to a generative model on the tested endpoint. The
embedding probe independently returned `ModelNotOpen` for the embedding model.
No screenshot from the SUT was uploaded in the failed screening.

## Required console action

In Ark, open the model's **开通管理/模型服务** access for the account, or create
an **在线推理接入点** for `doubao-seed-2-1-pro-260628` and copy the resulting
endpoint ID. If the console provides an endpoint ID, set that ID as
`CUA_MODEL` in the ignored profile and rerun the probe. Do not start matched
pilot collection until the probe returns HTTP 200 and both visual and hybrid
drivers complete a bounded one-step smoke.

The profile and registry changes are intentionally fail-closed: model access is
recorded as pending rather than treating model-list visibility as evidence of
successful inference.
