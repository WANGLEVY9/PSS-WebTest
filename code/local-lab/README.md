# Benchmark observatory

An English, local-first console for **official benchmark integration runs**. The current selection uses unmodified WebArena-Verified tasks **163–167**, template 136, source commit `6473f72db5dcefc97b5725b59e734504edc28a21`; earlier task-21/22 records remain available. It invokes the **stock WebArena-Verified 1.2.3 evaluator**, not a replacement page assertion. This is not confirmatory collection.

## Start the environment and console

```bash
cd /Users/laurantwang/PSS-WebTest/code
colima start webarena-x86 --activate=false
docker --context colima-webarena-x86 start webarena-verified-shopping-x86
node local-lab/probe-benchmark.mjs
node local-lab/server.mjs
```

Open <http://127.0.0.1:4173/>. **Run benchmark** starts the pinned selection shown in its confirmation dialog. The current development tranche is tasks 163–167 (template 136), fifteen executions across three strategies; previous task-21/22 batches remain available. Same-origin token and a runner lock protect the local launch endpoint. The server binds to loopback only. Runs persist on disk if the browser tab closes. Ctrl-C stops the server, not necessarily its already launched runner; do not start a second legacy runner against the same site.

See [EXPANSION-PLAN.md](./EXPANSION-PLAN.md) for all three core benchmarks, stage gates, source anomalies, denominators and continuation limits. No background schedule is currently installed. The current v3 prompt generalizes from reviewer names to the requested review text; never pool it with v1/v2 repetitions.

Existing `code/.env` supplies the Alibaba API key and compatible base URL. The local default is **qwen3-vl-flash**, without overwriting the global model. `PSS_LOCAL_MODEL` overrides only this console. No keys are printed or checked in.

Prerequisites, if absent:

```bash
npm ci
npx playwright install chromium
uv venv .venv-benchmark --python 3.12
uv pip install --python .venv-benchmark/bin/python ./artifacts/benchmark-snapshots/webarena-verified
```

The existing x86 shopping container must be provisioned separately. A missing container is not automatically replaced with a homemade task. See `benchmark-config.json` for the shopping URL and `benchmark-selection.json` for the pre-run task choice. Upstream: <https://github.com/ServiceNow/webarena-verified>.

## Interface and paper capture

- Select an experiment and official case; all three strategies show the **same task** side by side.
- Inspect persisted frames with per-arm timelines, previous/next/latest controls, and click-to-enlarge with SHA-256 provenance.
- Inspect accepted actions, model outputs, API usage, runtime, output-contract failures and **official evaluator** outcomes separately.
- Click a ledger row to switch cases. Download the snapshot, event stream or replay trace.
- **Figure view** removes navigation and operational controls, preserving task provenance, actual outcomes, failure boundaries and the non-confirmatory label. Escape exits it. Do not crop away the evidence-scope label in a paper.
- The UI polls durable state every second. An evaluator exception is shown as unresolved with an unavailable score, not as a valid zero score.

The design uses consistent serif headings, tabular numbers, neutral surfaces and restrained semantic color. All interface text is English; raw evidence remains unchanged rather than translated or fabricated.

## Experimental boundaries

Official `agent-input-get` exports model-facing inputs without reference answers. Intent text is unchanged. The selected tasks are read-only product-review retrieval, selected before any strategy execution. A fresh anonymous Chromium context and blocked non-read requests isolate each arm; **this does not establish a full database reset gate**. Each arm uses a 1280×720 viewport, with an agent budget of 24 decisions / 240 seconds and request timeout of 45 seconds.

- Pure visual receives screenshots and its own accepted-action history. Logged URL and observer replay DOM never control its decisions.
- Hybrid additionally receives visible, hit-tested, viewport-bounded control labels and observation-local IDs.
- Playwright is an **AI-assisted, fixed public-UI adaptation**. Semantic predicates were fixed before agent execution / reference evaluation; reviewer names are never hard-coded. This is not a human-authoring fairness claim.
- The original evaluator runs only after the arm has terminated and its browser has closed. `strict_pass` requires valid termination, budget compliance and official success. Agent claims are not ground truth.

Protocol `wav-retrieval-json-v1` incorrectly serialized an empty completed retrieval as SUCCESS. `v2` corrects the general public response contract to NOT_FOUND_ERROR. The same semantic script and task selection remain unchanged. Old results are retained; **do not pool the two protocol versions as repetitions**. A response-induced evaluator schema exception is unresolved, not proof of external infrastructure failure or agent incapability.

This adapter is a native PSS integration runner, not an AgentLab/Browser Use result. Two tasks from one template cannot establish comparative capability or replace outcome-blind screening and formal benchmark admission. VisualWebArena and ATA are not silently marked as running.

## Evidence and verification

Private artifacts: `code/artifacts/local-runtime/<batch>/`:

- Official public inputs, immutable source copies (v2 onward), digests, `snapshot.json`, append-only `events.jsonl`.
- `<arm>-<task>-NNN.jpg`, `<arm>-<task>-trace.zip`, provider output and usage.
- `<arm>/<task>/agent_response.json`, full HAR, original `eval_result.json` and evaluator log. Full evaluator results include references and must not be shown to active agents or exposed in the UI.

```bash
node --test local-lab/*.test.mjs
npm run test:contracts
node local-lab/validate-benchmark.mjs --export-public
```

The public summary exports credential-free counts, digests and official statuses only. HAR, prompts, screenshots and reference answers remain ignored. Monetary cost is unavailable; actual reported tokens are not converted into invented charges. Previous self-authored Juice Shop smoke data is retained as `LIVE_ENGINEERING`, excluded from the benchmark console and validated separately by `validate.mjs`. `runner.mjs` is the legacy smoke entrypoint and is **not** launched by this console.
