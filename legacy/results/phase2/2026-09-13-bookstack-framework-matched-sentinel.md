# BookStack framework matched sentinel: Browser Use, Stagehand, and AgentLab

Date: 2026-09-13  
Status: framework-replication pilot; not primary-arm admission and not
confirmatory evidence.

## Scope

After the native visual/hybrid boundary analysis, two external Hybrid
framework adapters were exercised on the same authenticated BookStack
navigation intent (`bookstack-open-book`, clean-stable). Each run received a
fresh seeded reset and the independent visible route/heading oracle. The
framework strata are kept separate from the native Hybrid arm and from one
another.

## Results

| Configuration | Framework/model | Outcome | Interpretation |
|---|---|---:|---|
| `hybrid-browser-use-grounded-candidate` | Browser Use 0.13.10 / Qwen3.7-VL Flash | 1/1 strict pass | Model-backed framework run reached `/books/book`; six provider events and six replay frames were recorded |
| `hybrid-stagehand-grounded-candidate` | Stagehand 3.0.8 / custom Qwen client | 0/1 model-only success | Visible oracle reached, but one bounded locator fallback was required; recorded as `framework-fallback`, not a model success |
| AgentLab/BrowserGym adapter smoke | AgentLab 0.4.2 + BrowserGym 0.14.2 | setup/oracle smoke pass | Deterministic adapter action reached the visible oracle; no LLM policy was invoked, so this is not a model-backed Hybrid result |

The Browser Use record reports `agent_success=true`, `oracle_passed=true`,
`checkpoint_reached=true`, and `strict_pass=true`. The Stagehand record reports
`checkpoint_reached=true` but `fallback_assisted=true` and
`model_only_success=false`, which is the intended fail-closed outcome.

The AgentLab adapter reports a screenshot and accessibility-tree observation,
`/books/book`, heading count 1, and independent oracle pass. Its result is
useful for adapter/environment validation only; it must not be counted as a
CUA/Hybrid capability observation until an AgentLab model policy is wired with
the same action and replay contract.

## Engineering correction

The Browser Use adapter previously treated a manifest-relative interpreter path
as relative to `code/`, causing a false `ENOENT`. The runner now resolves a
relative `PSS_BROWSER_USE_PYTHON` against the repository root while preserving
absolute paths. The first failed launch is retained as infrastructure evidence;
the subsequent successful run is the valid framework pilot.

## Evidence files

- `code/artifacts/phase2/bookstack-browser-use-qwen-clean-records.jsonl`
- `code/artifacts/phase2/bookstack-stagehand-qwen-clean-records.jsonl`
- replay manifests remain local with screenshot frames under the ignored replay
  directory; the JSONL records retain bounded provenance and hashes.

These framework results do not alter the primary three-arm admission count.
They are replication candidates for T3 and may only enter a nested model ×
framework analysis after the relevant application passes the primary admission
gate.
