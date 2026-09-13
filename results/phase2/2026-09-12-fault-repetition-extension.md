# Functional-fault repetition extension (2026-09-12)

Evidence boundary: one application, one workflow, one mutation, two provider
strata, pilot repetitions. Not confirmatory. Provider strata are never pooled.

## Why

The 3-repetition fault block left the Qwen and DeepSeek strata statistically
indistinguishable: Wilson 95% intervals for Qwen visual `[0.000, 0.561]` and
DeepSeek visual `[0.439, 1.000]` **overlap**. The extension raises the Qwen
repetition count to see which contrasts can actually be separated.

## Blocks

| Run tag | Provider | Repetitions per arm | Condition |
|---|---|---|---|
| `fault-r4` | aliyun + deepseek | 3 | `functional-fault`, mutation `search-result-label-omission` |
| `fault-r8` | aliyun | 8 | same |

Both use the frozen provider profile, the 12-step reference budget, the aligned
expected product derived from the mutation definition, and per-repetition reset.
The ledgers are separate and are not pooled.

## Results

### Qwen, 8 repetitions

| Arm | Passes | Rate | Wilson 95% | Failure categories |
|---|---:|---:|---|---|
| Playwright | 8/8 | 1.000 | [0.676, 1.000] | — |
| Pure visual | 2/8 | 0.250 | [0.071, 0.591] | `agent-step-budget` ×6 |
| Hybrid | 3/8 | 0.375 | [0.137, 0.694] | `agent-step-budget` ×5 |
| **Total** | **13/24** | 0.542 | | |

Matched repetition rate (all three arms passing in the same repetition): 0.125.

### DeepSeek, 3 repetitions (from `fault-r4`, unchanged)

| Arm | Passes | Wilson 95% |
|---|---:|---|
| Playwright | 3/3 | [0.439, 1.000] |
| Pure visual | 3/3 | [0.439, 1.000] |
| Hybrid | 3/3 | [0.439, 1.000] |

## Which contrasts are now separated

| Contrast | Intervals | Verdict |
|---|---|---|
| Qwen playwright vs Qwen pure visual | [0.676, 1.000] vs [0.071, 0.591] | **SEPARATED** |
| Qwen playwright vs Qwen hybrid | [0.676, 1.000] vs [0.137, 0.694] | overlap |
| Qwen pure visual vs DeepSeek pure visual | [0.071, 0.591] vs [0.439, 1.000] | overlap |
| Qwen hybrid vs DeepSeek pure visual | [0.137, 0.694] vs [0.439, 1.000] | overlap |

**One contrast is now separated**: within the Qwen stratum, the
accessibility-locator Playwright baseline outperforms pure visual on the
functional-fault condition at 8 repetitions.

Three contrasts still overlap. The cross-provider comparison in particular needs
more repetitions on the DeepSeek side, which is the natural next extension.

## What the 3-repetition block got wrong

The original `0/3` for Qwen visual and hybrid was **not** a reliable estimate.
At 8 repetitions the same arms score 2/8 and 3/8. The direction survives — the
agent arms really do fail far more often than Playwright on this condition — but
`0/3` overstated the effect, and reporting it as a rate would have been wrong.
This is the concrete reason the project forbids treating small-n cells as
population rates.

## Failure mechanism (stable across blocks)

All Qwen agent failures remain `agent-step-budget`: the arm issues exactly 12
actions and emits no verdict. The failure category distribution is unchanged
between 3 and 8 repetitions, which is itself evidence that the mechanism is
systematic rather than noise.

See `2026-09-12-step-budget-ablation.md` for the declared 20-step ablation,
which shows the budget is only part of the explanation.

## Boundaries

- One application, one workflow, one mutation, one short task.
- The mutation is a visible-text rename scored on the visible-state authority;
  the independent database oracle is unchanged by design.
- DeepSeek remains at 3 repetitions, so cross-provider contrasts are still
  under-powered. Do not read the Qwen/DeepSeek difference as settled.
- 8 repetitions is still a pilot count. It separates the largest within-stratum
  contrast; it does not freeze a repetition count for the study.

## Next work

1. Extend the DeepSeek fault block to 8 repetitions so the cross-provider
   contrast can be tested.
2. Re-run the stratified power simulation on the 8-repetition block.
3. Add a persisted-state fault family so the fault condition can be scored
   against the database authority rather than visible text only.
