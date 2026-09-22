# Qwen3.8 Max / Flash WAV paired batch: launch receipt

Evidence timestamp: 2026-09-22, approximately 07:36 UTC. This is a **partial
diagnostic snapshot**, not completion of the batch or confirmatory evidence.

## Scope and measured progress

Only official WebArena-Verified Shopping tasks 260 and 274 are in this bounded
acceptance batch. The fixed sequence contains 14 executions: two tasks ×
(two models × three agent configurations + one shared Playwright baseline).
Agent configurations are AgentLab visual, AgentLab hybrid, and restricted
Browser Use hybrid. There is no Browser Use pure-visual configuration.

At this snapshot, task 260 has completed with native score 1 for Playwright and
Qwen3.8-Max AgentLab visual. Both have sealed valid native evaluations, complete
replay integrity checks and completed owned-instance cleanup. The visual run
used two provider requests and two actions. Max AgentLab hybrid was dispatched;
Flash runs were still queued, not claimed as executed or API-verified.

The source is `code/artifacts/local-runtime/qwen38-pair-20260922-001`; private
trajectories, HAR, screenshots and provider data remain outside public Git.
The [sanitized snapshot](2026-09-22-qwen38-pair-progress-001.json) records sealed
rows and pending cells separately. Fresh fixture startup took approximately
246 and 216 seconds, respectively; reset time is not actor execution time.

## Implementation and checks

- Explicit model selection is bound into configuration hashes, requests and
  reports. No provider/model fallback or runtime script repair was introduced.
- Each execution creates its own fresh owned fixture, retains native evaluation
  and append-only events, and cleans up only its exact owned resources.
- The batch stops on reported engineering/external failures, missing native
  assessment or failed cleanup. Native score zero alone is not an exclusion.
- The two models use one shared host spend ledger. Official Beijing CNY tariffs
  are supported directly; unresolved costs remain reserved. At the snapshot,
  accounted exposure was CNY 0.058404 with no unknown holds or alerts. This is a
  tariff-derived usage amount, **not a reconciled provider invoice**.
- Portable offline verification passed 609 checks with unchanged source;
  historical-asset/native deployment groups were not promoted to passes.
  A separate exporter test verifies partial-result and model-identity behavior.

Tariff/model references checked 2026-09-22:
[Qwen3.8-Max](https://help.aliyun.com/zh/model-studio/qwen3-8-max) and
[Qwen3.8-Flash](https://help.aliyun.com/zh/model-studio/qwen3-8-flash).
Aliases are recorded as aliases, not immutable model snapshots. Published list
prices do not assume remaining free quota or discounts.

## Remaining boundaries

This is not the 100-task campaign, not a full-WAV sample, and not GPT acceptance.
Only targeted reset/peer controls exist; full mutable-state closure and general
authenticated-task parity are not claimed. The remaining 100-task adapters,
authentication and admission still need work. AI-written Traditional scripts
remain diagnostic, not independently human-blinded evidence.

For a later 100-task two-model comparison, a shared model-free script would yield
700 unique executions at one repetition (600 agent + 100 script), not 800
independent observations. This arithmetic is a planning clarification, not an
authorization or a completed-data count.
