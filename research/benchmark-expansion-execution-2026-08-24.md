# Benchmark expansion execution record (2026-08-24)

## Completed in this iteration

1. Added `code/config/replication-subset.v0.1.json`. It distinguishes local WebTestPilot adaptations, public benchmark design references, collision references, and blocked candidates. It records source URLs, local paths, license status, observation contract, oracle type, adaptation, and required admission evidence.
2. Added `code/scripts/audit-third-party-benchmark.mjs` and `npm run bench:audit`. The script inventories the locally vendored WebTestPilot cases and bug scripts, records step/assertion counts, and hashes source files without copying them into the public task corpus.
3. Added `research/benchmark-replication-plan-2026-08-24.md`, which specifies reuse boundaries, task difficulty strata, and the confirmatory admission rule.

## Local source audit

The local WebTestPilot benchmark currently contains 27 BookStack cases plus 27 bug scripts, 25 Indico cases plus 25 bug scripts, 23 PrestaShop cases plus 23 bug scripts, and 25 Invoice Ninja cases plus 25 bug scripts. The representative cases were inspected directly rather than inferred from paper abstracts. The repository declares CC BY 4.0 in its license file. The raw third-party directory remains ignored by the public PSS-WebTest repository.

The first replication candidate is `bookstack-create-page`: it has an explicit five-step source intent and a matching bug script, and it maps to our project-owned cross-page persistence task with a visible-state and persistence oracle. This is a methodological adaptation, not a reproduction of WebTestPilot's reported performance.

## Existing pilot re-analysis

The current ledger was re-summarized without changing or deleting records:

- BookStack navigation clean: 3 matched repetitions, 3/3 for each arm. This is pilot evidence only. The descriptive 95% Wilson interval for each arm remains broad because `n=3`.
- BookStack create-page latest condition-separated pilot artifact: 1 repetition, Playwright 1/1, visual 0/1, hybrid 1/1. The visual failure is an execution/planning failure, so it is not converted into an oracle failure or silently dropped.
- The historical create-page ledger contains older runs and is not substituted for the latest pre-registered pilot artifact. It shows material provider variance and is useful for failure taxonomy, not for freezing power.

The planning script now uses `cell_passed` first and only falls back to agent-completion plus independent-oracle success. This prevents a post-timeout oracle pass from being counted as a successful cell. Power output remains explicitly planning-only.

## What cannot be claimed yet

- No external benchmark task has entered confirmatory collection.
- No repetition number or power target is frozen.
- The WebTestPilot result is not a baseline result for PSS-WebTest because its symbolic GUI/oracle protocol differs from our three-arm observation contracts.
- WebArena, VisualWebArena, BrowserGym/AgentLab, WorkArena++, Online-Mind2Web and WebTestBench currently contribute design provenance or task strata, not pooled outcome data.

## Next executable gate

When a local SUT is available, run `npm run bench:audit -- --output /tmp/pss-webtestpilot-index.json`, then admit only the BookStack source-intent adaptation after the clean/evolution/fault reset and independent-oracle gates pass. Indico remains blocked until the authenticated create-event plus independent PostgreSQL fault workflow is live. Only after a stable matched pilot across task strata should the power simulation inputs be frozen.
