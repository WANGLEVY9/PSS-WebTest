# Analysis and protocol

This directory contains the versioned manuscript analysis contract, record import and outcome calculations. The [current WAV campaign plan](../config/current-campaign.json) is separate: it does not yet bind task IDs or implement a full GPT dispatcher.

`study-design.mjs` validates the historical `pss-manuscript-v2.1` protocol. `study-pipeline.mjs` reconciles its schedule and records. `study-analysis.mjs` and `analysis-export.mjs` calculate descriptive research summaries from explicit inputs. Missing opportunities and provenance remain visible. `study-workflow.mjs` plans or imports supplied bundles; it does not run a benchmark.

Run `npm run test:study-analysis` from `code/` for arithmetic and import regression. Passing these tests does not establish native benchmark results or authorize collection.
