# Qwen live lifecycle diagnostics

These controls use **synthetic tasks with real browser/framework/provider execution**.
They are not WebArena-Verified, VisualWebArena, or ATA task executions, and cannot
admit a benchmark adapter or enter a confirmatory denominator.

## Prerequisites and safety

- Run from the repository root, after installing the pinned framework environments
  and Chromium described in the sponsor deployment documentation.
- Keep the existing Aliyun credentials in the ignored `code/.env`; never place
  credentials in commands, source code, reports, screenshots, or public commits.
- This runner sets the model/provider only in its process; it does not change
  `.env`. An explicit `PSS_LOCAL_ENV_FILE` override is refused to avoid accidentally
  testing a different model under a Qwen label.
- `--live` is required and authorizes paid requests. Without it, no fixture or
  API call is created. Use a new output directory for each execution; an existing
  directory is refused, so earlier failures cannot be overwritten.
- A run has a 150-second actor budget, 10 action budget and bounded output tokens.
  Each provider attempt has a 30-second timeout. Setup/evaluation/finalization/
  transport also have separate lifecycle limits. The ledger's reservation cap
  is conservative accounting, **not actual billing or a guaranteed provider cap**.

## Reproduce the three execution paths

The commands below select the provider's `qwen3.8-max` alias (not an immutable
snapshot). Record returned model IDs and freeze a snapshot before confirmatory use.

```bash
third_party/frameworks/h-agentlab/bin/python code/experiment/lifecycle-live-smoke.py \
  --framework agentlab-browsergym --mode visual --model qwen3.8-max \
  --coordinate-space qwen-0-999 --max-output-tokens 1024 \
  --output code/artifacts/local-runtime/qwen-max-visual-control-001 --live

third_party/frameworks/h-agentlab/bin/python code/experiment/lifecycle-live-smoke.py \
  --framework agentlab-browsergym --mode hybrid --model qwen3.8-max \
  --coordinate-space css-pixels --max-output-tokens 1024 \
  --output code/artifacts/local-runtime/qwen-max-agentlab-hybrid-control-001 --live

third_party/frameworks/h-browser-use/bin/python code/experiment/lifecycle-live-smoke.py \
  --framework browser-use-restricted --mode hybrid --model qwen3.8-max \
  --coordinate-space css-pixels --max-output-tokens 1024 \
  --output code/artifacts/local-runtime/qwen-max-browser-use-hybrid-control-001 --live

third_party/frameworks/h-agentlab/bin/python code/experiment/lifecycle-live-smoke.py \
  --framework playwright --mode traditional \
  --output code/artifacts/local-runtime/playwright-control-001 --live
```

The Traditional path does not call a model. CSS coordinates for Hybrid are an
**exploratory configuration**, not a silently changed frozen study configuration.
To reproduce the initial normalized-coordinate failures, use `qwen-0-999` with
1024 output tokens. The token-only sensitivity branch uses `qwen-0-999` and 2048.
Do not merge these variants into one success-rate estimate or retry until success.

## What a run proves, and what it does not

The actor uploads a supplied public image, opens a second tab, and returns its
visible confirmation code. A supervisor checks the uploaded bytes, tab count and
answer **after actor termination**. The answer and hidden DOM sentinel are not
provided as feedback. Pure visual retains the existing pixel/action boundary;
Hybrid receives its allowed visible page structure. No coordinate snapping,
gold answer injection or failed-output unwrapping is used.

Each process creates a new loopback server, browser context and ledger. This proves
only control-fixture isolation, not cross-instance reset/isolation of a benchmark
database. Browser traffic is restricted to that fixture. The provider still
receives the authorized synthetic screenshots and, for Hybrid, page structure.

Private outputs include `report.json`, `envelope.json`, `ledger.sqlite` and
`trajectory/` with step screenshots, request/response records, a journal, HAR,
Playwright trace and supervisor lifecycle seal. The immutable envelope must pass
`verify_lifecycle`; the trajectory must pass `replay_audit.audit`. Artifact
integrity does not prove evaluator semantic correctness or benchmark admission.
Exit code 2 preserves a failed run; inspect `failure_class`, finish reason,
request timing and screenshots before attribution. Never recode an environment
or provider failure as a model task-capability failure without supporting evidence.

Public exports must omit credentials, endpoint workspace IDs, local private
paths, raw prompts/responses and authenticated screenshots. Retain run IDs,
configuration, report/trajectory hashes, terminal states and aggregate usage.
Unknown cost/usage is null, not zero. Concurrent control timings are not a fair
cross-arm latency comparison.

## Official benchmark gate remains separate

Before running any official task, verify the pinned benchmark installation,
task-bound wrapper/authentication, per-arm reset and cross-instance isolation,
native evaluator, task-to-schedule binding and independent admission evidence.
The synthetic controls above do not alter those gates. On 2026-09-22, no new
official task execution was admitted; deployment findings and all live control
results are recorded in `results/local-runtime/2026-09-22-qwen38max-live-diagnostics.*`.
