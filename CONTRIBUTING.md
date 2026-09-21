# Contributing to PSS-WebTest

Contributions should make the research comparison clearer, execution more reproducible, or measurement more reliable. See [the current design](docs/RESEARCH.md) and [roadmap](docs/STATUS.md#roadmap) before extending an older pilot path.

## Good first contributions

- Reproduce a failing offline check and provide the commit, command and environment.
- Add a focused negative control for an observation boundary or native evaluator.
- Exercise missing/duplicate observations, unequal denominators or shared-baseline handling in an analysis fixture.
- Document a platform-specific installation issue without changing pinned dependencies silently.
- Correct a broken link, stale design description or command that does not work from a fresh checkout.

Use [the issue forms](https://github.com/WANGLEVY9/PSS-WebTest/issues/new/choose) for bugs, reproduction reports and proposals. Keep credentials, private inputs and authenticated traces out of public discussions. Security reports use [SECURITY.md](SECURITY.md).

## Development workflow

```sh
git clone https://github.com/WANGLEVY9/PSS-WebTest.git
cd PSS-WebTest/code
npm ci
npx playwright install chromium
npm run study:validate
mkdir -p artifacts/local-runtime
npm run sponsor:verify:portable -- \
  --python python3 --output artifacts/local-runtime/contribution-check-001
cd ..
node scripts/check-docs.mjs
./scripts/check-public-boundary.sh
```

Choose a new output directory each time. The portable checks need no provider credentials, old cloud data, manuscript or benchmark downloads. Historical `test:contracts` includes artifact-dependent tests; do not conceal missing dependencies as passing tests. See [reproduction layers](docs/REPRODUCIBILITY.md).

For a documentation-only correction, validate links, commands and the publication boundary; a full environment reset or model run is unnecessary. For code changes, run the relevant regression plus the portable suite when the change affects shared contracts/runtime/analysis. Model/API experiments are a separate, explicitly scoped activity.

## Research integrity in a contribution

1. Follow the active design pointer. Preserve historical protocols and their original labels instead of rewriting old results into a new configuration.
2. Keep real execution, diagnostic, synthetic and planned evidence distinct. Internal mock tables must not become public empirical results.
3. Preserve scheduled, prepared, started, scorable and unresolved denominators. A late native success does not erase an operational timeout.
4. Keep reference labels, evaluator internals and other-arm outcomes outside actor inputs and blinded script preparation.
5. Treat framework, model, prompt, budget, task inclusion, metric or missingness changes as protocol changes. Document their scope and comparability.
6. Do not infer effect estimates, significance, costs or missing executions from rounded aggregate tables.

## Pull requests

Lead with the concrete problem and resulting behavior. Include the affected design/runtime/analysis layer, exact validation performed, any unexecuted checks, and remaining environment or provider requirements. Add source/task/protocol references when the change concerns research evidence. Keep changes focused and update the relevant guide when a command or contract changes.

No live model calls or benchmark resets belong in the default CI path. Tests for actual scientific claims need independently sourced evidence; synthetic fixtures can establish only code behavior. Avoid unnecessary dependencies for documentation and simple validators.

Software contributions use the [MIT License](LICENSE); upstream data retain their terms. Project participation follows the [Code of Conduct](CODE_OF_CONDUCT.md).
