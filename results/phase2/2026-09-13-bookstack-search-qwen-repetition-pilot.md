# BookStack search/open-book2 Qwen repetition pilot

Date: 2026-09-13
Status: pilot evidence; not confirmatory and not sufficient for application
admission.

## Design

The longer `bookstack-search-and-open-book2` workflow was run with two
independent repetitions under the clean-stable condition. Each repetition
used a fresh BookStack reset and randomized arm order. The task required the
agent to open Search, observe the Search Results heading, open Books, select
Book2, and stop at the exact `/books/book2` overview route. The independent
oracle checked route and visible heading; hidden database state was not sent to
the agents.

## Result

| Arm | Strict pass | Protocol complete | Oracle pass |
|---|---:|---:|---:|
| Pure visual Qwen3.7-VL Flash | 2/2 | 2/2 | 2/2 |
| Hybrid Qwen3.7-VL Flash | 2/2 | 2/2 | 2/2 |
| Accessibility-locator Playwright | 2/2 | 2/2 | 2/2 |

The matched artifact is:
`code/artifacts/phase2/bookstack-search-open-book2-clean-stable-aliyun-qwen3.7-flash-phase2-t1-bookstack-search-qwen-rep2-20260913-pilot.json`.

## Interpretation

This two-repetition block is evidence that the visual and Hybrid protocols can
be stable on this longer, navigation-only task under the current Qwen profile.
It does not contradict the create-page title boundary: that workflow requires
form state management and persistence, which is a different task family. It
also does not establish a universal winner because all three arms passed and
the block is still a small pilot stratum. The result should feed the pilot
variance table as a task-family × condition observation, not be pooled across
the failed form-persistence strata.
