# Provider protocol normalization and readiness gate (2026-09-12)

Evidence boundary: configuration and protocol-plumbing evidence only. This
artifact does not admit any application, does not freeze repetition counts, and
contains no confirmatory result.

## Problem being fixed

Before this change the action mode of an agent arm was an **implicit
per-provider default inside the driver**:

| Provider | Implicit default action mode | Implicit default API mode |
|---|---|---|
| `aliyun` | `tool` | `chat` |
| `deepseek` | `tool` | `chat` |
| `volcengine` | `json` | `chat` |

The `code/.env.doubao` profile does not set `CUA_VOLCENGINE_ACTION_MODE` or
`CUA_VOLCENGINE_API_MODE`, so that stratum silently resolved to textual JSON
while the model matrix declared `tool_calling: true`. The aligned PrestaShop
batch additionally inherited `CUA_ALIYUN_ACTION_MODE=json`, which repeated the
search-box click and never issued the `type` action. That is the documented
cause of the pure-visual `0/15` block, and it is a protocol confound, not a
capability result.

## What changed

1. **`code/config/provider-profile-manifest.v0.1.json` (new).** Single source of
   truth for provider/model protocol: `api_mode`, `action_mode`,
   `coordinate_mode`, `max_output_tokens`, `max_retries`,
   `max_decision_retries`, `timeout_ms`, the referenced optimization profile,
   the local env file, and the declared readiness status. Six profiles cover
   Qwen3.7-Flash, the legacy-registered `qwen3-vl-flash`, DeepSeek
   `deepseek-v4-flash-vision-exp`, its canonicalised `deepseek-flash` label, and
   the Doubao 2.1 / 2.0 strata.
2. **`code/src/provider-profile.mjs` (new).** Resolver with an explicit
   precedence chain and a fail-closed strict mode:

   ```
   explicit env override  ->  frozen profile  ->  legacy default
   ```

   Every resolved field carries a `*_source` label (`env-override` /
   `frozen-profile` / `legacy-default`), so the layer that produced a protocol
   value is always auditable.
3. **Both drivers** (`volcengine-cua-driver.mjs`, `volcengine-hybrid-driver.mjs`)
   now resolve the protocol from the manifest instead of hard-coded env
   defaults, and expose `getProtocolResolution()`.
4. **Run-record provenance** gained optional `provider_profile_id`,
   `action_mode`, `api_mode`, `action_mode_source`, `hybrid_action_mode` fields
   (v0.1 allowed-key set, v0.2 optional set, and the JSON schema). A protocol
   change can therefore never be reported as a strategy-family effect.
5. **`run-prestashop-agent-cell.mjs`** resolves the optimization profile from
   the manifest (the previous provider→profile map silently fell back to
   `baseline-v0`), sets `PSS_REQUIRE_FROZEN_PROFILE=1`, and records the resolved
   protocol.
6. **`code/scripts/check-provider-readiness.mjs` (new, `npm run
   readiness:provider`).** `npm run check:agent` only proves the environment
   variables exist. The new gate requires a real screenshot-only
   `click -> type -> keypress` conformance trace (plus a hybrid
   semantic-grounding trace) before a profile may enter a matched cell.
   SUT fixture credentials are merged from `code/.env`; provider settings come
   from the profile's own env file and win, so strata cannot bleed.
7. **`npm run validate:provider-profile`** validates the manifest (schema,
   uniqueness, enums, optimization-profile references) and cross-checks that
   every executable non-scripted configuration has a frozen profile.

## Readiness gate result

| Profile | visual | hybrid | Status |
|---|---|---|---|
| `aliyun-qwen3.7-flash-tool-v1` | ready `click->type->keypress` | ready `click->type->keypress` | **ready** |
| `deepseek-v4-flash-vision-tool-v1` | ready `click->click->type->keypress` | ready `click->type->keypress` | **ready** |
| `volcengine-doubao-2-1-pro-tool-v1` | blocked | blocked | **blocked** |

- Both ready strata typed the exact literal `Mug` into the search field.
- DeepSeek's visual trace contains one extra leading click, but the required
  ordered sequence and a non-empty typed value are present. This is a protocol
  conformance result, not a claim that DeepSeek grounds reliably on longer
  tasks: the earlier aligned block still shows repeated-coordinate loops on the
  multi-step workflows.
- Doubao is blocked by an **external account boundary**, not a protocol defect:
  HTTP 429, "Your account [2127044686] has reached the set inference limit for
  the [doubao-seed-2-1-pro] model, and the model service has been paused. To
  continue using this model, please visit the Model Activation page to adjust or
  close the Safe Experience Mode." The stratum is recorded as blocked and is
  skipped by the matched pilot until the boundary is resolved; it is not
  reported as a capability result.

Gate output: `code/config/provider-readiness.v0.1.json`.

## Verification

| Check | Result |
|---|---|
| `npm run test:contracts` | 131/131 pass (123 pre-existing + 8 new profile tests) |
| `npm run validate:provider-profile` | 6 frozen profiles; executable registry coverage 8/8 |
| `npm run validate:configuration-registry` | 16 configurations (visual=6, hybrid=8, scripted=2) |

## Boundaries and open items

- The manifest freezes the *declared* protocol. It does not by itself prove
  provider behaviour; the readiness gate does, and only for the three-action
  conformance task.
- Doubao requires an Ark console action (resume the model / close Safe
  Experience Mode). Until then the study runs two provider strata.
- The configuration registry uses `aliyun-compatible` as a provider id while
  the manifest uses `aliyun`; the validator therefore cross-checks coverage by
  model id and reports rather than fails on provider-id naming. Unifying the
  provider-id vocabulary is an open cleanup item.
- `code/config/agent-optimization-profiles.v0.1.json` still holds the
  token/retry/coordinate values; the manifest references it rather than
  duplicating it. If the two ever disagree, the manifest's `max_*` values are
  the ones the drivers use.

## Next work

1. Resolve the Doubao account boundary, then re-run `npm run readiness:provider`
   for that stratum only.
2. Unify provider-id vocabulary between the configuration registry and the
   manifest.
3. Add the readiness status to the configuration registry admission evidence
   once the matched pilot passes for a stratum.
