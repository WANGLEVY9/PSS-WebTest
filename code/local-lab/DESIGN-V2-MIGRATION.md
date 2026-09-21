# Manuscript-aligned execution contract v2.0

## Decision and amendment (2026-09-21)

The user explicitly retired the old execution plan and directed this project to follow the current manuscript. `config/active-study-design.json` is now the sole current design pointer. `study-design-contract.v2.1.json` records authority, source hash and change rationale. Old v1.0 and v2.0 files are retained as history, not execution authority. Default design/plan validation commands resolve v2; use `--legacy-audit` only for historical tests. This is a repository amendment, not a claim of external preregistration or retrospective pre-outcome freezing.

| Dimension | Retired execution plan | Adopted design |
| --- | --- | --- |
| Models/configurations | Two shared models, five primary configurations | Six models; AgentLab/BrowserGym visual and hybrid, restricted Browser Use hybrid, plus one shared human-authored Playwright script: 19 |
| Selected workload | Generic ≥3,000 opportunity target | WAV 600, VWA 700, ATA 113 (62 PASS/51 FAIL) |
| Repetitions | Pilot 5, later choose 5/7/10 | 12: D1–D2 discovery, V1–V10 validation |
| Retry comparison | Earlier planning logic | V1–V5/V6–V10; ≥8 jointly assessed validation rounds; first available per configuration/window |
| Inference | Earlier power/Holm/mixed-effects plan | Current manuscript's descriptive estimands; identification bounds are not confidence intervals |
| Collection strategy | Old local readiness snapshot | Reconcile existing collection; prioritize missing GPT results; do not infer global completion from local visibility |

The total selected denominator is 322,164 scheduled opportunities. Prepared, started, scorable, imported and completed are distinct counts. The author reports substantial existing data and a GPT gap. Local summary tables are not row-level ledgers; their presence cannot establish which model runs are complete. No historical files or cloud results were rewritten.

The user corrected the manuscript population on 2026-09-21. Active v2.1 uses all 113 published ATA cases, 62 PASS and 51 FAIL, with no rebalancing or invented exclusion. `ata-source-population.v1.json` pins the six CSV digests. v2.0 remains historical and its 112-case aggregate results require reanalysis; adoption does not prove live fixture parity or executed coverage.

## Configuration and budget binding

IDs v1/h1/u1 through v6/h6/u6 follow the model order in the contract; s is shared once, not copied six times. Display model names are not substituted for verified API IDs. Neither the legacy custom PSS runner nor Qwen3.7 can be relabeled AgentLab or Qwen3.8 to fill a missing cell.

The manuscript fixes *matched* task budgets but not numeric values. The local cloud-export template also leaves those values unfilled. `study-runtime-bindings.v2.0.example.json` deliberately does not invent them or inherit old 24-action/240-second diagnostic limits. Recover actual timeout, action budget, browser/viewport/locale/timezone, prompts, image/model settings, action schema and framework revisions. Bindings participate in schedule identity. Inconsistent configuration digests in one imported stratum are rejected. New GPT observations must match the original comparison settings or be reported under a documented separate protocol version.

Budget validation is structural, not proof that a model endpoint, boundary contract or reset actually works. The runtime dispatcher remains blocked by existing environment/adapter gates.

## Executable entrypoints

From `code/`:

```bash
npm run study:validate
# Input and output should be in ignored code/artifacts/; output directory must not already exist.
npm run study:workflow -- plan artifacts/import-bundle.json artifacts/new-schedule
npm run study:workflow -- import artifacts/import-bundle.json artifacts/new-import
npm run sponsor:verify
```

Neither workflow command starts a browser, calls a model, resets a SUT, accesses a cloud host or automatically reruns unimported opportunities. It validates first, creates a new directory, preserves source bytes and hashes, and exports schedule/coverage/analysis/observability. Source files are never edited. Plan generation interleaves configurations deterministically and puts all discovery rounds before validation. It produces dispatch candidates, not fake results. A lease-based durable executor and admitted framework adapters remain separate work.

## Import bundle (normalized JSON adapter)

Top-level fields: `protocol_id: pss-manuscript-v2.1`, `scope: formal|diagnostic|synthetic`, `tasks`, `records` for import, optional `bindings`, optional `preparation`.

- Task: `task_key`, `benchmark: wav|vwa|ata`, `application`, `official_task_id` (string), `source_sha256`; WAV `template_id`; ATA independent `expected: PASS|FAIL`. Formal scope requires exactly 600/700/113 and ATA 62 PASS/51 FAIL, with distinct namespaced official identities. Diagnostic scope may use a smaller official set. Original eligibility evidence remains independently necessary.
- Record: `task_key`, `config_id`, `round: D1|D2|V1...V10`, `phase: discovery|validation`, `source_opportunity_id`, `source_sha256`, `configuration_sha256`, `data_kind: MEASURED|SYNTHETIC_TEST`, `preparation_status: prepared|unprepared|unknown`, `started` boolean, `assessment_status: valid|unresolved`, `budget_met: true|false|null`, `terminal_status`, `native_score: 0|1|null`, `verdict: PASS|FAIL|null`, and ATA TP `step_class: AFB|AFC|AFA|Ustep`.
- Terminal status: `completed`, `failed`, `no-verdict`, `timeout`, `provider-error`, `reset-error`, `evaluator-error`, `not-started`. Original attempts/retries remain in the source archive; one explicitly selected observation per planned opportunity is allowed. Duplicates are rejected, never resolved by selecting the best outcome.
- Optional resource fields: `execution_charge_usd`, `agent_wall_ms`, `total_tokens`. Missing values stay unknown, with reported-subtotal/coverage; no assumed monetary rate or preparation-cost amortization.
- Preparation: unique `prep_id`, `benchmark: wav|vwa|ata|SHARED`, `config_id`, `scope: task|configuration|shared`, `measurement_basis: logged|retrospective_estimate|assumed|unknown`, `authoring_minutes`, `debugging_minutes`, `review_minutes` (nonnegative or null). Shared script labor is not multiplied by the number of model comparisons. Failed preparation remains included. Different measurement bases are reported separately.

Cloud CSV/Parquet exports need explicit field mapping to this normalized adapter; it does not yet auto-detect every external export format. Unknown missing records are counted as **not imported**, never as globally not run or model failure. Their analytical bounds remain unresolved until imported. The supplied hash values are provenance references, not independent certification of source truth. Structural validation does not certify task eligibility, labels, source hashes, actual model capabilities or human authoring.

## Formula corrections and regression

- RQ3 now computes `Y_alternative - Y_visual`, where Y is **correctness**. The earlier candidate export used the reverse error-rate direction. Its only exercised end-to-end outputs were synthetic tests; no confirmed production dataset was imported with that candidate in this local work. Any external use of that candidate must regenerate analysis from source rows under v2, retaining the old output for audit.
- RQ4 uses the same eligible blocks and weights for mixed execution and both retry controls; ATA pooled and PASS/FAIL-specific outputs are available.
- Native late success is preserved while an out-of-budget opportunity is operationally unsuccessful. ATA observed no-verdict is zero operational correctness; unresolved evaluation/reset remains unknown. Unprepared opportunities remain in the fixed denominator.
- Tests include a 322,164-slot schedule generation stress test and a 684-row synthetic three-benchmark, 19-configuration, 12-round import/analysis pipeline. These are software checks, not new benchmark observations or empirical model results.

## Remaining blockers before a new official-task smoke

1. Import the original task selection, runtime bindings and row-level records (or locate them on an authorized host). Do not access a company host or provision cloud services implicitly.
2. Recover matching numeric budgets/API IDs; verify the GPT image/output interface, without adding forbidden information.
3. Complete the selected official task's reset/evaluator/dependency gate and the claimed AgentLab/BrowserGym or restricted Browser Use adapter. The local retrieval adapter alone does not satisfy those framework claims.
4. Run a small clearly nonformal official-task smoke, preserve every failure and trace, then admit only the verified scope. Resume GPT supplementation after reconciling existing opportunities; do not silently launch the full matrix.
