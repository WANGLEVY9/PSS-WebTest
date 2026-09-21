# Analysis alignment and cost-controlled routing

Engineering status: candidate analysis implemented and tested on explicitly synthetic fixtures. No new benchmark executions, no paid model requests, no revised confirmatory authorization. Private manuscript/source files are not part of this public artifact.

## Authority and remaining closure

The tracked v1.0 execution plan and the newer private design revision differ. Do not automatically substitute model counts, task counts, repetitions, or framework claims. `study-analysis.mjs` is versioned `candidate-rq-analysis-v1`; it supplies computations without rewriting old results or frozen plans. `paper-metrics.mjs` remains a legacy single-block API and should not be used for the new multi-round estimands.

Still required: explicit protocol amendment and configuration freeze; outcome-blind eligible selection/human adjudication; blinded Traditional preparation ledger; complete benchmark reset/evaluator admission; per-cell reset integration; accepted framework-specific adapters; durable scheduler and raw-data import. API connection alone does not satisfy these requirements. No values are reconstructed from rounded manuscript tables.

## Metric mapping

| Analysis layer | Implemented contract | Important boundary |
| --- | --- | --- |
| Native effectiveness | WAV per-round template macro then equal-round mean; VWA per-round task mean then equal-round mean | An entirely unscorable scheduled round yields unavailable overall native mean; represented-round counts are explicit |
| ATA testing correctness | FAIL-positive confusion matrix; binary coverage among **started** attempts; AFB/AFC/AFA/Ustep; step-mismatch fraction; confirmed/upper step-correct accuracy | Unknown step alignment is Ustep, not a mismatch or fabricated exact step |
| Operational effectiveness | Fixed selected task × round grid; unprepared zero, unresolved/missing null; task-level means and identification bounds | Missing slots never disappear from the operational denominator; native outcomes are separate |
| Repeated reliability | Always-correct/mixed/always-incorrect/unprepared/unresolved tasks; all-round and at-least-once bounds | A task with any unresolved slot stays unresolved, even if another attempt succeeded |
| ATA error-conditioned analysis | Discovery-only anchor cohort; two-complete-round controls; equal-case validation contrasts over same-round binary pairs; omitted-case bounds | Differences are comparator minus anchor error rates; bounds concern wholly omitted cases, not missing rounds; no causal claim |
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

Reset, evaluator, schema validation, locator execution and metric aggregation stay deterministic: **zero model calls**. Failure annotation is an optional, separate post-run route. It receives only whitelisted failure enums, HTTP status, action/request counts and latency—not screenshots, URLs, page structure, task intents, free-text errors, provider outputs, gold or other-arm results. It returns a provisional hypothesis and next inspection category, never an official failure cause, task action or oracle result. Full causal diagnosis still needs authorized replay inspection.

Suggested auxiliary model: [`gpt-5.6-luna`](https://developers.openai.com/api/docs/models/gpt-5.6-luna), officially described as a cost-sensitive model with image input and structured output. This implementation uses **metadata-only text**, not its image capability. Account availability and live behavior remain unverified. No price estimate is hardcoded; cached tokens, reasoning, long-context premiums and billing policy need explicit treatment before estimating costs.

In ignored `.env.openai`, opt in only when ready:

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
