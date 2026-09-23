# Reproducibility

[Project home](../README.md) · [Experiment map](EXPERIMENTS.md) · [Architecture](../code/ARCHITECTURE.md) · [Research design](RESEARCH.md)

Reproduce a study result by pinning its task population and source revisions, rebuilding the same execution schedule, restoring an independent environment for every opportunity, running the assigned method, and applying the benchmark-native evaluator. Preserve every attempt—including setup failures, timeouts, abstentions and missing outcomes—in the record set used for analysis.

## Study configuration

The study covers 600 WebArena-Verified (WAV) tasks, 700 VisualWebArena (VWA) tasks and 113 ATA/piñata cases (62 PASS, 51 FAIL). Six model identities are compared across three agent cells: AgentLab visual (v), AgentLab hybrid (h) and restricted Browser Use hybrid (u). A single Playwright script cell (s) is shared across model comparisons. Each task/configuration has two discovery rounds (D1–D2) and ten validation rounds (V1–V10). See the [experiment map](EXPERIMENTS.md) for benchmark-specific setup, method boundaries and evaluation steps.

## Prepare and validate

From `code/`, install the pinned dependencies and validate the study inputs:

~~~sh
npm ci
npx playwright install chromium
npm run study:validate
npm run campaign:validate
~~~

Create a task schedule and bind each opportunity to its model identity, framework profile, prompt, action/time/cost budget, environment, reset procedure and evaluator version. Keep credentials, task-specific private setup, and output ledgers outside Git. Use a new output directory for each run.

## Run and evaluate

For each benchmark × task × configuration × round:

1. Restore the benchmark fixture and verify the declared starting state.
2. Construct the actor input for v, h, u or s; keep private setup and evaluator references outside the actor boundary.
3. Run one isolated opportunity and journal its inputs, actions, termination, resource use and trajectory.
4. Apply the pinned native evaluator using its required state and artifacts: WAV evaluates the original response and network trace; VWA evaluates the final active page; ATA compares the structured verdict and failure step with the published case reference.
5. Seal the attempt, evaluator output, source identities and availability fields in the record ledger.

Report benchmark outcomes with their native definitions. Keep task effectiveness, operational correctness, evaluator coverage, preparation effort, execution cost and missingness distinct. Do not remove failed or indeterminate opportunities from denominators without a documented estimand-specific rule.

## Analyze and share

Import records with `code/analysis/study-workflow.mjs`; compute the RQ1–RQ4 summaries with `code/analysis/study-analysis.mjs`. Analysis inputs must carry task, model, execution cell, round, evaluator and source provenance. Preserve null outcomes and report coverage and identification bounds where outcomes cannot be determined.

Before sharing, validate the tables against the underlying records, review exclusions, and remove credentials, personal data, private fixtures and raw traces unless their release is authorized. Publish the source revision, study configuration, task-selection rule, evaluator version and analysis commands with the aggregate result.

From the repository root, check documentation links and public file boundaries:

~~~sh
node scripts/check-docs.mjs
./scripts/check-public-boundary.sh
~~~
