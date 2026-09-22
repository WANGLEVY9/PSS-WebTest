# Reproducibility guide

For full environment preparation, use the [cloud installation handoff](../code/local-lab/cloud-handoff/README.md), [declared dependency inventory](../code/local-lab/cloud-handoff/dependency-manifest.json), and [acceptance receipt template](../code/local-lab/cloud-handoff/acceptance-receipt.example.json). Read the [input/output contract](technical/INPUT_OUTPUT.md) and benchmark/framework [technical index](technical/README.md) before running paid tasks. The CNY budget implementation remains an integration dependency, not an active guarantee for every mainline request path.

[Project home](../README.md) · [Research design](RESEARCH.md) · [Evidence status](STATUS.md)

Choose the reproduction layer that matches your question. Code verification, analysis reproduction, environment acceptance and empirical replication require different inputs.

| Layer | Requires | Establishes |
| --- | --- | --- |
| Source-only checks | Checkout, Node 20+, Python 3, npm and Chromium | Contract/formula/runtime regression behavior |
| Analyze a supplied ledger | Independently sourced task/round records and frozen design/provenance | Arithmetic and denominators for those records |
| Benchmark integration | Pinned official sources, application fixtures, framework environments, reset/evaluator evidence | Acceptance of a specific environment/configuration |
| Empirical replication | Accepted integration, selected task IDs, exact runtime bindings, prepared scripts, model access and execution evidence | Outcomes for the declared campaign |

## 1. Verify without model calls

From the repository root:

```sh
cd code
npm ci
npx playwright install chromium
# Fresh Linux installation with system dependencies:
# npx playwright install --with-deps chromium
npm run study:validate
mkdir -p artifacts/local-runtime
npm run sponsor:verify:portable -- \
  --python python3 --output artifacts/local-runtime/offline-001
```

The directory `offline-001` must not already exist. The portable runner uses actual local Chromium for observation/console tests, but does not call model APIs, launch official benchmark executions, reset benchmark fixtures or enable the collection gate. It writes source hashes, per-group counts and logs. A test failure or source change during verification makes the aggregate report fail.

Four historical artifact-integration files are explicitly excluded by default: benchmark snapshot, LLM screening simulation, outcome-blind candidate export, and screening-ledger template tests. The report lists them as **not-run**. They require downloaded snapshots/generated inventory. Use `--with-artifacts` only after acquiring those inputs, and select a new output directory. These legacy inventory checks are separate from active v2.1 admission.

Useful narrower commands, from `code/`:

```sh
npm run test:study-analysis
npm run test:runtime-reliability
npm run test:adapter-conformance
npm run test:phase2-provenance
npm run validate:manifests
npm run validate:configuration-registry
npm run validate:study-assets
```

From the repository root:

```sh
node scripts/check-docs.mjs
./scripts/check-public-boundary.sh
```

The public-boundary check inspects tracked/staged publication paths; it is not a full secret detector. Do not interpret it as a substitute for reviewing screenshots, logs and credentials.

## 2. Reproduce analysis from your own source records

Read the [input contract](../code/local-lab/ANALYSIS-AND-ROUTING.md). Keep configuration, selected task order, rounds and source/schedule digests explicit. Missing opportunities must remain visible. Rounded manuscript tables cannot be expanded into source executions.

From `code/`, with your reviewed input file:

```sh
# These are user-supplied input paths, not files shipped with the repository.
node local-lab/analyze-study.mjs /path/to/analysis-input.json /path/to/new-report.json
node local-lab/study-workflow.mjs import /path/to/source-bundle.json /path/to/new-import-directory
```

`analyze-study` uses `pss-analysis-input-v1` with an explicit evidence kind; the workflow bundle separately carries the active protocol and `formal`, `diagnostic` or `synthetic` scope. These labels do not authorize collection. Existing outputs are not overwritten. Importing or validating records does not establish the truth of their underlying evidence or the completion of data absent from the local machine.

Current calculations are descriptive. They preserve task/round and shared-baseline dependence in the design; they do not produce confidence intervals or p-values from rounded aggregates. See [the metric map](RESEARCH.md).

## 3. Prepare an official benchmark environment

Follow [deployment and acceptance](../code/local-lab/SPONSOR-DEPLOYMENT.md), using a dedicated, resettable environment and an explicit private host profile. The current full deployment target is native Linux x86_64; support on that host must be demonstrated, not inferred from the developer workstation.

Keep benchmark and framework Python environments separate. Use pinned sources, fixture/image identities and reviewed platform-compatible locks. The existing macOS framework locks are not proof of a working Linux installation. Avoid the legacy environment-building helper when it would rewrite a frozen lock.

The host doctor inspects rather than provisions:

```sh
# From code/, after preparing this ignored profile with actual host paths.
node local-lab/sponsor-portable-doctor.mjs \
  --profile artifacts/local-runtime/sponsor-deployment.json \
  --live-docker --output artifacts/local-runtime/doctor-001.json
```

That output file must be new. Read missing/unverified checks as unresolved. Official input mapping, per-execution reset, native positive/negative evaluator controls, observation/action boundaries and blinded script preparation all need their own acceptance evidence. A healthy homepage or framework import is insufficient.

## 4. Inspect the local console

```sh
# From code/
npm run sponsor:console
```

Open `http://127.0.0.1:4173/`. This observatory displays local integration evidence; starting it does not make the study runnable. Keep its execution gate and provenance labels intact. The older read-only dashboard (`npm run dashboard:serve`) uses the same default port; run one at a time. Do not expose either console publicly.

## 5. Capture a reproducible report

Record the commit and source-tree changes; OS/architecture; Node, Python and browser versions; official source and task IDs; fixture/image identities; active protocol; exact configuration/budget binding; command; selected/start/scorable counts; source/report digests; and any skipped checks. Report provider/API identity and token/cost coverage without keys or private payloads.

Use the [reproducibility issue form](https://github.com/WANGLEVY9/PSS-WebTest/issues/new/choose). Share a minimal sanitized failure, not a private ledger. No promise of identical model outputs is implied by deterministic schedule or arithmetic checks.
