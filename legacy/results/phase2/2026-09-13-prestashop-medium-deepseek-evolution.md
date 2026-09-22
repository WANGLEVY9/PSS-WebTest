# PrestaShop medium UI-evolution matched pilot — DeepSeek V4.1-Flash

Date: 2026-09-13

Status: pilot/diagnostic evidence; not confirmatory.

The behavior-preserving search-layout mutation was applied after the repaired
AJAX search milestone. Playwright and Hybrid completed the medium
search/open-product workflow and passed the independent oracle (1/1 each).

Pure visual failed before reaching the search-results checkpoint: DeepSeek
issued the same click at `(831,124)` twice, the progress guard rejected the
third attempt, and the run was classified `grounding-loop`. HTTP requests were
successful and the reset/oracle layers were healthy, so this is a model/action
grounding boundary rather than provider quota or SUT infrastructure failure.

| Arm | Strict pass | Boundary |
|---|---:|---|
| Pure visual | 0/1 | grounding-loop |
| Hybrid | 1/1 | model-only clean |
| Playwright | 1/1 | scripted locator |

The result is retained as a conditional model × evolution observation and is
not pooled with the DeepSeek clean/fault cells until repetitions and task
coverage are frozen.
