# Qwen WebArena task 351: engineering remediation addendum

Scope: **diagnostic only**. This adds three fresh official task-351 executions to
the earlier five-task snapshot. The old 46 process attempts remain intact; the
descriptive total is now 49 process attempts across the same five distinct
official tasks. Attempts, retries, model variants and framework variants are
not independent task samples or confirmatory observations. The companion JSON
records sanitized configuration/report digests; raw screenshots, requests,
HAR, native result and credentials stay in ignored private artifacts.

| Fresh configuration | Native score | Actor result | What changed |
| --- | ---: | --- | --- |
| Flash, restricted Browser Use Hybrid | 0 | 24 actions, budget exhausted | One-action JSON schema was enforced; no empty action list or other invalid action occurred. All 24 emitted actions were clicks, and sorting remained incomplete. |
| Max, AgentLab pure visual, compact action output | 0 | Completed after 10 actions | All 10 provider responses completed; maximum output was 44 tokens, compared with the prior request that reached the 2,048-token cap. Six repeated sort clicks preceded a premature `done`. |
| Max, AgentLab pure visual, exact screenshot stall feedback | 0 | Completed after 8 actions | One exact no-change screenshot signal was supplied; the actor still clicked the sort control and declared completion before a visible sort change. |

Each fresh attempt used its own official Shopping fixture, pinned task input,
unchanged official evaluator, replay audit and owned cleanup. All three native
assessments were valid, all three actor source snapshots were unchanged during
execution, and none had an engineering exception. The synthetic Browser Use
type control also passed with two real Qwen requests; it adds zero benchmark
executions.

## Failure attribution

- **Interpreter/framework mismatch:** the earlier Browser Use launch from the
  AgentLab interpreter was an engineering failure. The framework-package gate
  now rejects that mismatch before reset. The provider and priced output-token
  preflight also runs before reset for agent configurations.
- **Provider timeout and output truncation:** the earlier Max visual task-351
  attempt ended with `finish_reason=length` at the 2,048-token cap after a long,
  narrative model response. A task-independent instruction now requests one
  short native action. The new Max visual attempt had 10 completed responses,
  at most 44 output tokens each. This is evidence of a working mitigation in
  this run, not a claim that provider latency has become universally stable.
  A separately priced 4,096-token diagnostic setting is available but was not
  used for these three official attempts.
- **Invalid model action:** upstream Browser Use advertised an array of actions
  without a valid JSON Schema `minItems`/`maxItems` constraint while the actor
  required exactly one action. The request schema now matches that runtime
  contract. The earlier Flash `[]` failure did not recur in the new official
  run. AgentLab Flash's earlier malformed `noop(...)` remains a model action
  contract failure; the runner does not silently repair its output.
- **Repeated clicks:** the official Shopping sort control is a native select.
  The Playwright page screenshot shows the closed select and can remain
  unchanged while the operating-system popup is open. Generic keyboard
  guidance was added to both agent frameworks without exposing DOM, URL or
  evaluator data. The new Flash Browser Use run still issued 24 clicks. The
  opt-in pixel-only no-change signal did not make Max visual complete the
  sort. This is a combined screenshot-observability and model action-selection
  limitation under the current headless page-screenshot interface.
- **Native evaluator score 0 after `done`:** the final Max visual screenshot
  still displayed `Sort By: Position`. The actor's completion text was not
  treated as an oracle. The official score of 0 is retained. Related-product
  pages or search filters on tasks 261/351 must likewise not be substituted
  for the benchmark's required navigation outcome.

No extra task data or structure entered pure visual. Both agent frameworks
received only the same generic native-select instruction. The optional stall
signal is computed from the already captured screenshot bytes and is carried
in a separately hashed diagnostic configuration. It reports exact visual
nonchange only; it never infers task progress, success or evaluator state.

Verification: 52 focused Python lifecycle/boundary tests and seven provider
bridge tests passed. The active default still leaves the pixel stall flag off.
The task-351 variants must not be pooled into a success-rate comparison. The
remaining evidence points to model strategy and the screenshot interface for
this task; further outcome-driven prompt or oracle changes would need a
separately frozen protocol and new matched runs.
