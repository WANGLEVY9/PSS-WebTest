# Experimental harness plan

The eventual harness will run matched test intents in three arms:

1. **Pure-visual CUA:** screenshot-only action loop; no DOM or accessibility-tree observations.
2. **Hybrid agent:** screenshot plus a declared DOM/accessibility representation.
3. **Traditional arm:** Playwright scripts using accessibility-first locators and explicit state assertions.

All arms use the same matched intent and are scored by an independent evaluator. An arm's self-reported verdict is never treated as ground truth.

Each execution record should include application version/mutation, task ID, run ID, outcome, ground-truth verdict, wall time, model/API cost, retries, trace path, and human repair time. Secrets belong only in a local `.env` file and must never be committed.

## Initial setup

```sh
cd code
cp .env.example .env
npm install
npx playwright install chromium
npm run test:traditional
```

The smoke test intentionally requires a self-hosted SUT; no external website should be used as an experimental target.

## Phase 2 contracts

The hybrid arm receives the screenshot and an explicitly declared
`pageStructure` (an accessibility/DOM-derived representation), plus optional
viewport metadata.  It must not receive evaluator outputs, application state,
mutation labels, or database/network data.  The observation-contract checker
recursively rejects those forbidden fields, including when nested inside the
structured representation.  The checker admits element roles, names, states,
and stable harness references only as observation data; it does not treat any
of them as a gold oracle.  See
`tests/contracts/hybrid-agent-contract.test.mjs` for the executable boundary.

The current pilot manifest is `manifests/task-manifest.v0.1.json`. It marks BookStack, Indico, and Juice Shop as `provisional` applications: their reset and task-oracle feasibility gates pass, but confirmatory admission and fault/evolution coverage are not yet complete. Validate it before editing or running a task:

```sh
npm run validate:manifests
npm run check:sut -- http://127.0.0.1:8081
npm run check:agent
```

On macOS, `PSS_BROWSER_CHANNEL=chrome` can use an already-installed Google Chrome build for feasibility smoke tests. Confirmatory runs must freeze and record one browser build/channel across all arms.

`schemas/task-manifest.schema.json` defines the task/application contract and `schemas/run-record.schema.json` defines the immutable execution record. The latter distinguishes test failure, timeout, model refusal, evaluator failure, and infrastructure failure; these states must not be collapsed into a single success-rate number.

## Phase 2 local lifecycle commands

The scripts below delete only their named experimental containers/Compose volumes. They do not alter the ignored WebTestPilot checkout.

```sh
npm run sut:bookstack:reset
npm run oracle:bookstack
npm run test:contracts

npm run sut:indico:reset
npm run sut:juice-shop:reset
```

BookStack, Indico, and Juice Shop now each have a task-level Playwright slice and an independent feasibility oracle. BookStack additionally has a verified persistence fault and behavior-preserving UI mutation. The pure-visual and hybrid arms have strict observation contracts; they are not considered executable until real provider adapters pass those contracts under a fixed budget.

`npm run check:agent` checks only whether `CUA_PROVIDER`, `CUA_MODEL`, and `CUA_API_KEY` are present; it never prints the key. A blocked readiness result is expected until a real CUA provider is selected. The adapter tests use contract-only drivers and are not experimental Agent results.

Phase 2 design decisions prioritize evidence published or released from 2023 onward. The local `third_party/` directory is a read-only checkout area and is ignored by Git; it is not part of the public replication package.
