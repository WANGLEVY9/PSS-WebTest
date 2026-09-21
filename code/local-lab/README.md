# Local experiment workbench

This is a real, bounded **engineering smoke**, not an implementation of all manuscript experiments. It never imports manuscript tables or simulated data. The public benchmarks remain separately gated.

## Start

```bash
cd /Users/laurantwang/PSS-WebTest/code
colima start
npm ci                       # only if dependencies are missing
npx playwright install chromium  # only if the bundled browser is missing
node local-lab/server.mjs
```

Open <http://127.0.0.1:4173/> and click “启动三策略最小实验”. The server binds only to localhost. Keep the process running; Ctrl-C stops the console. A runner already started may finish independently; its PID and durable artifacts identify it. Do not start the older dashboard on the same port. To inspect the old ledger separately: `PSS_DASHBOARD_PORT=4175 npm run dashboard:serve`.

Secrets are read from the existing gitignored `code/.env`. The new workbench defaults to **qwen3-vl-flash** using the existing Alibaba API key/base URL. It does not overwrite `CUA_MODEL` in `.env`. An explicit local override is supported:

```bash
PSS_LOCAL_MODEL=qwen3.7-flash PSS_LOCAL_PORT=4174 node local-lab/server.mjs
```

The UI reports the selected batch's actual model. Check the batch protocol, not just the current environment. Never pool runs from different model/prompt/coordinate/output protocols as repetitions.

## What actually runs

- The existing volume-free `pss-juice-shop` container is recreated before each arm. No other application database is reset. This erases only this disposable experiment container's state.
- Same search intent, fresh Chromium context, 1280×720 viewport, 16 decisions and 240-second agent budget. Arms are serialized because they share one resettable SUT. A runner lock rejects overlapping resets from this workbench; unrelated legacy runners do not honor it and must not be started concurrently.
- Visual: screenshot and self-action history, no DOM/URL/milestone feedback.
- Hybrid: screenshot and visible, viewport-bounded, unoccluded control projection; observation-local IDs map to coordinates from that observation, not a subsequently rebuilt mapping.
- Script: role-based search workflow. This engineering script is **not** a blinded adaptation of an official benchmark task.
- Independent evaluator executes after agent termination. No evaluator feedback is used to extend the run. `strict_pass` requires valid completion, budget compliance and oracle success; merely saying “pass” is insufficient.
- Current configuration is a native PSS diagnostic runner, **not** AgentLab or Browser Use. It does not claim their results or generalize a single-task failure to a whole paradigm.

The reset digest covers the read-only apple-search product fixture, not the full database. It is not sufficient for admitting state-changing benchmark tasks. Frames/trace capture and oracle execution are observer work, never model inputs. Failures are retained, not retried until a pass.

## Persistent evidence

`code/artifacts/local-runtime/<batch-id>/` (gitignored):

- `snapshot.json`: model, budget, protocol, order, per-arm outcomes and metrics; current runs also record source/dependency hashes and runner PID.
- `events.jsonl`: append-only timestamped events; the snapshot is an atomically replaced materialized view, not an append-only ledger.
- `<arm>-NNN.jpg`: screenshots, with SHA-256 in snapshot.
- `<arm>-trace.zip`: Playwright replay, including observer-only DOM evidence; keep private by default.
- `process.log`: local runner diagnostics.

The UI supports batch switching, three side-by-side arm panels, per-arm frame sliders, action histories, model action output/usage, reset evidence, oracle details and JSON/JSONL/trace downloads. It polls durable state every second. No model chain-of-thought, Authorization headers or API keys are displayed.

Native benchmark scores and monetary costs remain **null** here. Tokens are actual provider-returned usage, not converted into an invented bill. Initial diagnostic batches may lack an agent-duration field after an exception; the validator reports this instead of treating the missing duration as zero.

## Validation and benchmark gate

```bash
node --test local-lab/*.test.mjs
npm run test:contracts
node local-lab/validate.mjs
# Explicitly export only the credential-free engineering summary:
node local-lab/validate.mjs --export-public

colima start webarena-x86 --activate=false
docker --context colima-webarena-x86 start webarena-verified-shopping-x86
node local-lab/probe-benchmark.mjs
```

The WebArena probe uses the already provisioned x86 profile and writes a sanitized health report. A ready shopping service is **not** a passed reset/evaluator/selection gate, nor permission to start confirmatory collection.

`paper-metrics.mjs` contains tested pure aggregators for template macro averaging, ATA confusion counts, operational identification bounds and matched retry controls. Unit-test fixtures are mathematical checks, not empirical evidence. Full RQ3 cohort construction, ATA failure-step scoring, runtime confidence intervals and a cloud-run import adapter are not implemented by this smoke.
