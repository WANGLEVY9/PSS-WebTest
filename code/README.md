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

## Configuration registry and v0.2 records

`config/configuration-registry.v0.2.json` separates a strategy family from its
concrete execution configuration: framework/version, provider and model,
observation/action contract, prompt fingerprint, or scripted-test framework
and authoring source. The five existing historical configurations are labelled
`legacy-pilot`; they remain readable as v0.1 records but cannot be relabelled
as confirmatory evidence. The three v0.2 configurations are only
`implemented`, not admitted for formal collection.

Validate the registry and all ledger records before any pilot or formal run:

```sh
npm run validate:configuration-registry
npm run records:audit -- ../artifacts/phase2/records.jsonl
```

A v0.2 run must contain a registered `configuration_id`, matching strategy and
observation contract, protocol version, randomization block, and SHA-256
digests for the run manifest, SUT image, reset state, environment, trace and
agent prompt. `records:collect` and `records:audit` reject a v0.2 record that
does not resolve to this registry or conflicts with its framework/provider
metadata. Unknown token or billing cost remains `null`, never zero.

Before a configuration can enter a clean admission pilot, run the
provider-free adapter-conformance contract suite. It checks that each strategy
family admits only its declared observation, blocks hidden evaluator fields
before a decision or script execution, and records only aggregate action/retry
data at this gate:

```sh
npm run test:adapter-conformance
```

This is an infrastructure gate, not evidence that a real model can complete a
workflow. Provider connectivity, reset integrity, independent-oracle success,
and matched repetitions remain separate Phase 2 requirements.

## Phase 2 local lifecycle commands

The scripts below delete only their named experimental containers/Compose volumes. They do not alter the ignored WebTestPilot checkout.

```sh
npm run sut:bookstack:reset
npm run oracle:bookstack
npm run test:contracts

npm run sut:indico:reset
npm run sut:juice-shop:reset
```

The default BookStack port is `8081`. If another local service owns that port,
use the same alternate port for Compose and every runner, for example:

```sh
PSS_BOOKSTACK_APP_PORT=18081 BOOKSTACK_BASE_URL=http://127.0.0.1:18081 \
  npm run sut:bookstack:reset
PSS_BOOKSTACK_APP_PORT=18081 BOOKSTACK_BASE_URL=http://127.0.0.1:18081 \
  npm run pilot:bookstack:navigation
```

The lifecycle now passes the selected port explicitly to Compose, so the
readiness URL and the host mapping cannot silently diverge.

The first lower-complexity BookStack task is `bookstack-open-book`. It is a
non-confirmatory navigation pilot designed to isolate grounding from the rich
text editor workflow. It writes a matched summary and standard run records
under the ignored `../artifacts/phase2/` directory:

```sh
PSS_MATCHED_REPETITIONS=1 CUA_MAX_STEPS=8 CUA_TIMEOUT_MS=30000 \
  npm run pilot:bookstack:navigation
npm run metrics:summarize -- \
  --input ../artifacts/phase2/bookstack-navigation-records.jsonl \
  --output ../artifacts/phase2/bookstack-navigation-metrics.json
npm run pilot:variance -- \
  --input ../artifacts/phase2/bookstack-navigation-pilot.json \
  --output ../artifacts/phase2/bookstack-navigation-variance.json
```

The navigation oracle accepts only the exact `/books/<slug>` overview route;
chapter, page, draft, and editor descendants are rejected. One passing pilot
repetition does not freeze repetition counts or authorize confirmatory data
collection.

The navigation pilot permits one predeclared reset retry (`PSS_RESET_MAX_ATTEMPTS=2`)
to handle transient container/database startup races. Every retry is retained
in the pilot artifact as `reset_attempts` and `reset_retry_used`; it is never
silently removed from the infrastructure audit.

`pilot:bookstack:navigation` now defaults to the Phase 2 `2.0-draft` runner.
For each arm it resets only the named local BookStack SUT, hashes a small
read-only test-fixture snapshot, and records that reset digest together with a
deterministic arm-order block. The script emits registry-resolved v0.2 records;
`records:audit` deliberately fails until all three arms for a cell are present.
The visual and hybrid arms send screenshots to the configured model provider,
so obtain explicit approval for that authenticated *test-fixture* scope before
running a full matched block.

Use `PSS_PILOT_RUN_TAG` to prevent a rerun under a changed execution context
from appending to an earlier JSONL ledger. The tag is recorded in its summary
artifact and becomes part of the artifact filename; it is an isolation label,
not an experimental condition.

To run the behavior-preserving UI-evolution pilot, use the same matched task
and change only the condition/mutation labels:

```sh
PSS_PILOT_CONDITION=ui-evolution:bookstack-layout-v1 \
PSS_UI_MUTATION=bookstack-layout-v1 \
PSS_MATCHED_REPETITIONS=1 \
  npm run pilot:bookstack:navigation
```

The mutation is installed before navigation in every arm. It changes layout
CSS only; the independent route-and-heading oracle remains unchanged.

The more complex `bookstack-create-page` pilot uses the same condition-aware
artifact naming and reset retry policy through `npm run pilot:bookstack:matched`.

BookStack, Indico, and Juice Shop now each have a task-level Playwright slice and an independent feasibility oracle. BookStack additionally has a verified persistence fault and behavior-preserving UI mutation. The pure-visual and hybrid arms have strict observation contracts; they are not considered executable until real provider adapters pass those contracts under a fixed budget.

`npm run check:agent` checks only whether `CUA_PROVIDER`, `CUA_MODEL`, and `CUA_API_KEY` are present; it never prints the key. A blocked readiness result is expected until a real CUA provider is selected. The adapter tests use contract-only drivers and are not experimental Agent results.

Two local model profiles are currently available for CUA pilot runs. The
default `code/.env` profile is Qwen3-VL-Flash through the Alibaba-compatible
endpoint. The ignored `code/.env.doubao` profile is the restored Doubao Seed
2.0 Pro Ark profile. Run each model in a separate shell environment; pilot
artifact and ledger names include provider and model, so their outcomes cannot
be accidentally pooled:

```sh
set -a; source .env; set +a
PSS_PILOT_RUN_TAG=qwen-stabilization-v1 PSS_MATCHED_REPETITIONS=1 \
  npm run pilot:bookstack:matched

set -a; source .env; source .env.doubao; set +a
PSS_PILOT_RUN_TAG=doubao-stabilization-v1 PSS_MATCHED_REPETITIONS=1 \
  npm run pilot:bookstack:matched
```

`PSS_PILOT_RUN_TAG` creates an isolated summary and JSONL ledger instead of
appending a changed protocol to an older pilot.  Agent records separately
report the independently reached task state, correct agent termination, and
strict cell admission.  An oracle-confirmed postcondition after a timeout is
retained as `oracle_only_success=true` but is not counted as a passed cell.

Never commit either local profile or copy an API key into a report.

## Live local experiment dashboard

The dashboard is a **read-only local observability surface** for Phase 2. It
scans ignored `artifacts/phase2/*.jsonl` ledgers, reads the public benchmark
matrix, and performs short HTTP health probes of the three local SUTs. It never
serves `.env`, raw screenshots, prompts, credentials, action traces, or model
responses. A row is labelled `STRICT PASS` only when the stored record has a
completed execution, an independently reached checkpoint, and a matching
emitted/ground-truth verdict; pilot records are never promoted to confirmatory
findings by the UI.

```sh
cd code
npm run dashboard:serve
# open http://127.0.0.1:4173
```

The page receives an SSE refresh every 2.5 seconds, so newly appended ledger
records become visible during a run without writing or mutating experiment
data. Use `PSS_DASHBOARD_PORT=4174` if port 4173 is occupied. The dashboard is
bound to `127.0.0.1` by default; do not expose it on a public network without a
separate access-control review.

Phase 2 design decisions prioritize evidence published or released from 2023 onward. The local `third_party/` directory is a read-only checkout area and is ignored by Git; it is not part of the public replication package.
