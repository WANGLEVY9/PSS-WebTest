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

The current pilot manifest is `manifests/task-manifest.v0.1.json`. It deliberately marks BookStack and Indico as `provisional`, with unverified reset procedures and draft independent oracles. Validate it before editing or running a task:

```sh
npm run validate:manifests
npm run check:sut -- http://127.0.0.1:8081
```

`schemas/task-manifest.schema.json` defines the task/application contract and `schemas/run-record.schema.json` defines the immutable execution record. The latter distinguishes test failure, timeout, model refusal, evaluator failure, and infrastructure failure; these states must not be collapsed into a single success-rate number.

Phase 2 design decisions prioritize evidence published or released from 2023 onward. The local `third_party/` directory is a read-only checkout area and is ignored by Git; it is not part of the public replication package.
