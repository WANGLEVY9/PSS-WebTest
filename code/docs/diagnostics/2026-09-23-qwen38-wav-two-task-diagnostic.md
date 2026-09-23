# Qwen3.8 WebArena-Verified diagnostic progress (2026-09-23)

This is **development/diagnostic evidence**, not confirmatory collection. The
official WAV Shopping tasks are 260 (open Video Games) and 274 (search for
`usb wifi`). Each reported attempt used a separately owned, reset fixture and
the pinned native evaluator. The two models are the Aliyun `qwen3.8-max` and
`qwen3.8-flash` API aliases, not immutable model snapshots. Traditional
Playwright is model-free and counted once per task.

The machine-readable, credential-free [attempt ledger](2026-09-23-qwen38-wav-two-task-diagnostic.json)
contains 14 planned cells and 17 actual process attempts across interrupted
and resumed slices. It retains every reset, provider and source-change failure.
Eleven cells have exactly one *automatically analysis-eligible* attempt. Three
older task-260 cells produced native score zero but retain the raw
`execution-error` status, so they are not silently recoded by the merger.

| Task | Traditional | Max AgentLab visual | Max AgentLab hybrid | Max Browser Use hybrid | Flash AgentLab visual | Flash AgentLab hybrid | Flash Browser Use hybrid |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 260 | 1 | 1 | audit | 1 | 0 | audit | audit |
| 274 | 1 | 1 | 1 | 0 | 0 | 1 | 1 |

Numbers are native evaluator scores for automatically eligible attempts;
`audit` means a separately preserved native score-0 attempt requiring the
post-hoc model-action classification below. These rows are **not** a success
rate estimate: only two previously exposed public-navigation tasks were run,
there are no independent repetitions, and eight source fingerprints appear
across the resumed slices. No between-method or between-model superiority
claim is authorized.

## Failure attribution

- Task 260, Max AgentLab hybrid: the second model response included two
  `<action>` blocks (a repeated prior click and a completion action). The
  strict parser refused to choose one. Raw status: `execution-error/ValueError`;
  native score: 0. This is a model/framework action-protocol mismatch, not an
  evaluator or fixture failure.
- Task 260, Flash AgentLab hybrid: the second response was `noop(1000)`, but
  the declared action is `noop()` with no argument. Raw status:
  `execution-error/ValueError`; native score: 0.
- Task 260, Flash Browser Use hybrid: the first response was a JSON array,
  while the declared schema requires one JSON object. Raw status:
  `execution-error/ValidationError`; native score: 0.
- Task 274, Flash AgentLab visual and Max Browser Use hybrid: each exhausted
  its 24-action budget by repeatedly clicking one search-field coordinate.
  The final frame remained on the Shopping home page. Both are completed,
  replay-valid, score-0 agent attempts, not reset/provider failures.
- Three separate non-capability attempts are retained: an early Flash visual
  fixture-reset failure, a Max Browser Use run interrupted when a concurrent
  repository reorganization removed its source file, and a retry blocked by a
  shared spend-ledger task-ID collision with the unresolved prior reservation.
  None replaces or erases another attempt. Batch-qualified opportunity IDs
  now prevent that collision while leaving the shared budget cap unchanged.

The runner now records delivered but invalid model actions as
`invalid-model-action` instead of a generic exception. This is a prospective
classification change; the three older raw receipts above remain unchanged.
The sanitized merger separates a complete reset/actor/evaluator/cleanup chain
from an analysis-eligible method attempt. A provider-stop can satisfy the
former and must not enter the latter.

## Admission boundary and next cohort

The frozen 100-ID Shopping diagnostic candidate set has 100 public task
bindings, but only seven AI-assisted Traditional script *proposals* pass static
checks (IDs 260, 261, 274, 324, 351, 353 and 355). Zero of those seven are
certified as live-validated in the authoring ledger; the other 93 remain
pending. Task 261 has an additional static-only v5 locator proposal based on
Traditional-side menu observations. It must be executed as a new configuration,
not substituted for its older failures. Account/order tasks need the upstream
UI-login/storage-state parity gate before any agent failure can be attributed
to capability. Current isolation evidence covers targeted state controls, not
full mutable-state closure. The 100-task campaign and confirmatory collection
remain closed.
