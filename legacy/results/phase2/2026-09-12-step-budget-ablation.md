# Qwen step-budget ablation (2026-09-12)

Evidence boundary: a **declared** ablation of one parameter, run on one
application, one workflow, one condition. It is not a matched three-arm
estimate, it is not pooled with the 12-step baseline block, and it is not
confirmatory.

## Why

In the 2026-09-12 functional-fault block, every Qwen agent cell failed with
`agent-step-budget` after exactly 12 actions and emitted no verdict, while every
DeepSeek agent cell completed the same task in 5–6 actions. The open question
was whether that was a **budget artifact** or a **capability boundary**.

## Design

| | Baseline block | Ablation block |
|---|---|---|
| Run tag | `fault-r4` | `fault-stepbudget20` |
| `CUA_MAX_STEPS` | 12 (optimization profile default) | **20** |
| Condition | `functional-fault` | `functional-fault` |
| Mutation | `search-result-label-omission` | same |
| Provider | aliyun / qwen3.7-flash | same |
| Repetitions | 3 per arm | 3 per arm |
| Reset policy | per-repetition | per-repetition |

Everything else — provider profile, prompt, oracle, action schema — is
identical. The blocks are separate ledgers and are never pooled.

## Result

| Arm | Baseline (12 steps) | Ablation (20 steps) |
|---|---:|---:|
| Playwright | 3/3 | 3/3 |
| Pure visual | 0/3 | 0/3 |
| Hybrid | 0/3 | **2/3** |
| **Total** | **3/9** | **5/9** |

Ablation failure detail:

| Rep | Arm | Outcome | Actions | Emitted verdict | Failure category |
|---|---|---|---:|---|---|
| r1 | visual | fail | 14 | `fault` | `agent-verdict` |
| r1 | hybrid | pass | 3 | `fault` | — |
| r2 | visual | fail | 3 | `not-emitted` | `provider-format` |
| r2 | hybrid | fail | 19 | `clean` | `execution` |
| r3 | visual | fail | 16 | `fault` | `agent-verdict` |
| r3 | hybrid | pass | 3 | `fault` | — |

## Interpretation

**The budget is a contributing factor, not the whole explanation.**

1. **Partially repaired.** Hybrid recovers from 0/3 to 2/3 with the larger
   budget, and the recovered runs terminate in 3 actions — the same action count
   as Playwright. So the 12-step limit was cutting off some runs that would have
   succeeded.
2. **Failure modes change rather than disappear.** At 20 steps the failures are
   no longer `agent-step-budget`:
   - **`agent-verdict` (2 cells)** — the pure-visual arm *emitted* `fault`, the
     correct label, but the independent visible oracle did not confirm the fault
     state. The agent asserted a verdict without having reached the state it was
     asserting. This is a false positive in verdict, and it is arguably worse
     than emitting nothing, because a naive scorer would count it as correct.
   - **`provider-format` (1 cell)** — a provider output-shape failure, unrelated
     to the budget.
   - **`execution` (1 cell)** — hybrid ran 19 actions and then reported `clean`,
     i.e. a long non-progressing loop.
3. **Pure visual does not recover at all** (0/3 in both blocks). Two of its three
   ablation failures are `agent-verdict`, so a larger budget moved it from "no
   verdict" to "unsupported verdict", not to success.

## What this means for the study

- `agent-step-budget` must **not** be reported as a pure budget artifact. The
  ablation shows it is partly budget and partly a genuine boundary in verdict
  grounding and loop termination.
- The **`agent-verdict` failure category is doing real work**: it separates
  "reached the state and said the right thing" from "said the right thing". A
  study that scored only emitted verdicts would have mis-scored these two cells
  as successes.
- Any future Qwen arm needs the step budget **declared and frozen**, not tuned.
  The 12-step default should stay the reference; 20 is an ablation.

## Boundaries

- One application, one workflow, one mutation, one provider, 3 repetitions.
- The ablation changes only `CUA_MAX_STEPS`; the prompt, profile, oracle and
  action schema are unchanged and verified in the record provenance.
- The baseline and ablation ledgers are separate and must not be pooled. A
  combined figure would confound budget with repetition count.
- `provider-format` on a 3-action visual run is a provider-boundary observation,
  not a budget observation.

## Next work

1. Inspect the two `agent-verdict` traces to determine whether the agent was on
   the wrong milestone or mis-read the page.
2. Test an intermediate budget (16) to locate the transition, if a budget sweep
   is worth the SUT time.
3. Keep 12 as the frozen reference budget; treat 20 as a declared ablation.
