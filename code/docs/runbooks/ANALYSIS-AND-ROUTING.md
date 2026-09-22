# Analysis alignment and cost-controlled routing

Engineering status: active study `pss-manuscript-v2.1`, including the corrected ATA population of 113 (62 PASS / 51 FAIL). The implementation version string remains `manuscript-rq-analysis-v2.0.0`; it is not the active study version. The active authority is `config/active-study-design.json`. Existing collection is user-reported and must be reconciled, not inferred absent from the local console. Private manuscript/source files are not part of this public artifact. See `DESIGN-V2-MIGRATION.md` for operational status.

## Authority and remaining closure

The user retired the v1.0 execution plan on 2026-09-21. Its files remain audit history only. Model counts, task denominators, repetitions and framework crossing now follow v2.1. See the [current input/output contract](../../../docs/technical/INPUT_OUTPUT.md) and [testing paradigms](../../../docs/technical/TESTING_PARADIGMS.md). Existing outcomes are never rewritten. `paper-metrics.mjs` remains a legacy single-block API and should not be used for the new multi-round estimands. The previous candidate export reversed RQ3's sign by comparing error rates; v2.0 correctly compares alternative correctness minus visual correctness. Any outputs from the previous candidate must be regenerated from source rows, not sign-edited without checking their version.

Still required locally: recover actual selected IDs, historical configuration/budget bindings and preparation records; verify original selection/adjudication provenance; complete benchmark reset/evaluator admission and per-cell reset integration; accepted framework-specific adapters and durable dispatch. Data import and deterministic schedule generation now have explicit v2 entrypoints. Their structural validation does not prove independent evidence quality or authorize dispatch. No values are reconstructed from rounded manuscript tables.

## Metric mapping

| Analysis layer | Implemented contract | Important boundary |
| --- | --- | --- |
| Native effectiveness | WAV per-round template macro then equal-round mean; VWA per-round task mean then equal-round mean | An entirely unscorable scheduled round yields unavailable overall native mean; represented-round counts are explicit |
| ATA testing correctness | FAIL-positive confusion matrix; binary coverage among **started** attempts; AFB/AFC/AFA/Ustep; step-mismatch fraction; confirmed/upper step-correct accuracy | Unknown step alignment is Ustep, not a mismatch or fabricated exact step |
| Operational effectiveness | Fixed selected task × round grid; unprepared zero, unresolved/missing null; task-level means and identification bounds | Missing slots never disappear from the operational denominator; native outcomes are separate |
| Repeated reliability | Always-correct/mixed/always-incorrect/unprepared/unresolved tasks; all-round and at-least-once bounds | A task with any unresolved slot stays unresolved, even if another attempt succeeded |
| ATA error-conditioned analysis | Discovery-only anchor cohort; two-complete-round controls; equal-case validation contrasts over same-round binary pairs; omitted-case bounds | Differences are comparator minus anchor **correctness**; positive favors the alternative. Bounds concern wholly omitted cases, not missing rounds; no causal claim |
| Retry complementarity | Joint-availability gate; first available result per configuration per ordered window; identical four-outcome blocks; WAV template weights; retry controls and disagreement identities | Equal attempts do not mean equal monetary cost; paired outcomes are derived from native rows, not a separately edited table |
| Efficiency/observability | Per-request usage, fixed-route identity; preparation/agent/cleanup/evaluator clocks; reported token subtotal and coverage | Missing usage/latency is not zero. Cost remains unavailable without an audited, versioned billing rule |
| Engineering cost | Not yet a complete human preparation/time ledger | Never infer authoring hours from execution time or equate an AI-assisted script with a blinded human-authored baseline |

No composite weighted score or confidence intervals inferred from rounded values are produced. Statistics/power, preparation-cost aggregation, cross-benchmark aggregation and validated production data import remain separate work.

## Reproducible analysis input

`analyze-study.mjs INPUT.json OUTPUT.json` writes a **new** file (`wx`), source-input SHA-256, time and analysis version. Existing output is never overwritten. The input contract is `pss-analysis-input-v1`, with:

- `data_kind`: `DIAGNOSTIC`, `SYNTHETIC_TEST`, or `CONFIRMATORY_CANDIDATE` (none grants authorization).
- `schedule_sha256`, nonempty `source_sha256`: supplied provenance references. The exporter validates syntax, not the existence or scientific admission of the referenced sources; the admission pipeline must verify them independently.
- `strata`: one entry per `{benchmark: wav|vwa|ata, configuration_id}`. Configuration IDs refer to a separately frozen full configuration, not a model name alone.
- Each stratum contains `operational: {task_ids, rounds, rows, unprepared_task_ids?}`. Operational rows contain `task_id, round, correctness: 0|1|null`. Absence means unresolved; absence never means adaptation failure. Explicit unprepared tasks cannot also contain execution rows.
- `native_rows` contain `task_id, round, success: 0|1|null, template_id` for WAV, without mandatory template for VWA. ATA rows contain `expected: PASS|FAIL`, `started: boolean`, `verdict: PASS|FAIL|null`, and TP `step_class: AFB|AFC|AFA|Ustep`. Templates, reference labels and step classifications must come from independently audited benchmark evidence.
- Optional `pairs: [{benchmark, c, d, retry?, error_conditioned?}]` require identical ordered task selection and rounds. `retry` specifies ordered disjoint `first_window`, `second_window`, and optional `min_joint` (default 8); the report preserves that policy. `error_conditioned` (ATA only) specifies exactly two `discovery_rounds`, disjoint `validation_rounds`, and `error_type: false_pass|false_alarm`.

The exporter derives retry and discovery/validation outcomes from the strata, preserves missing opportunities, and rejects duplicate identities or outside-selection records. It does **not** turn the current small local diagnostic subset into a formal corpus. Independent schedule/source validation and a real data importer are still required.

## Fixed actor, low-cost auxiliary route

`OPENAI_MODEL` remains the fixed measured actor in both agent arms. Every new action request records role, provider, requested model, provider-configuration digest, policy and policy digest. `auditActorRouting` rejects changes inside that batch. Legacy runs are marked `legacy-unrecorded`, not retroactively certified. Alias-to-version resolution is retained through requested/returned model IDs; account-specific model access is not inferred.

Reset orchestration, schema validation, locator execution and metric aggregation use no model. Evaluator requirements are benchmark-specific: WAV uses its native evaluator; VWA can require fuzzy-text or visual judging, which remains blocked in the current deterministic-only integration until separately frozen, accounted and accepted. Do not replace those evaluators with cheaper arbitrary judgments. See [VWA evaluator requirements](../../../docs/technical/benchmarks/VWA.md). Failure annotation is an optional, separate post-run route. It receives only whitelisted failure enums, HTTP status, action/request counts and latency—not screenshots, URLs, page structure, task intents, free-text errors, provider outputs, gold or other-arm results. It returns a provisional hypothesis and next inspection category, never an official failure cause, task action or oracle result. Full causal diagnosis still needs authorized replay inspection.

The existing auxiliary example uses `gpt-5.6-luna` as a candidate model ID. It is not a claim of current API availability, price or measured equivalence. This implementation uses **metadata-only text**. Verify the provider-authorized exact ID and capabilities before enabling it. No price estimate is hardcoded; cached tokens, reasoning, long-context premiums and billing policy need explicit treatment before estimating costs.

The commands below describe the legacy post-run triage route, not the native framework driver. Do not enable paid triage until that route is included in the shared budget acceptance described in [runtime design](../../../docs/technical/RUNTIME.md). In ignored `.env.openai`, opt in only when ready:

```dotenv
PSS_AUX_ENABLED=1
PSS_AUX_MODEL=gpt-5.6-luna
PSS_AUX_REASONING_EFFORT=low
```

From `code/`, use an existing completed batch and failed record ID:

```bash
# Preview whitelisted payload; makes no API call.
PSS_LOCAL_ENV_FILE=.env.openai node local-lab/triage-failure.mjs local-BATCH RECORD_ID
# At most ONE request, 15-second timeout, 512 output-token cap, no retries/fallback.
PSS_LOCAL_ENV_FILE=.env.openai node local-lab/triage-failure.mjs local-BATCH RECORD_ID --live
```

Results are separate ignored `aux-triage-UUID.json` sidecars, with source snapshot/request/evidence digests, usage and model metadata. They never rewrite the snapshot, never affect benchmark scheduling and are not included in actor cost. The whole batch must finish first. Invalid model output fails closed; annotations require human review.

To evaluate Luna as an actor, configure it as a **separate fixed-model stratum** after the same gates. A dynamic cheap/expensive actor router is a different treatment and must have a separately frozen routing policy, information boundary, budget and analysis stratum; it is deliberately not silently installed here.

## Verification

`node local-lab/sponsor-verify.mjs` runs formula fixtures, route isolation/audit, env isolation, provider parsing, actual Chromium console rendering, benchmark boundary contracts, ATA preparation, ledger and frozen-manifest validation. Formula fixtures and mocked provider responses are synthetic tests, not empirical model results. Frontend and metric-module hashes are included in the verification artifact. All benchmark gates remain enforced.
