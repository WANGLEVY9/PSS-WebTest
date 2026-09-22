# PrestaShop fault runner repair and visual grounding ablation

Date: 2026-09-13

Status: pilot/diagnostic evidence; not confirmatory.

## Why the first visual failure was ambiguous

The first fault block reached the visual page but the runner reported the
milestone as `authenticated-home` because PrestaShop's AJAX search preserved
the `/` pathname and the result heading was not matched by the role-only
detector. The mutation-install trigger therefore depended on a brittle
observation condition. This was an engineering validity issue, not a CUA
capability result.

## Runner repair

`run-prestashop-agent-cell.mjs` now detects search-results using visible result
heading/breadcrumb plus the result-card container, independent of the URL and
one accessibility-role implementation. The fix keeps the screenshot-only and
screenshot-plus-structure contracts unchanged and adds no oracle state to the
agent observation.

## Repaired matched block

| Arm | Strict pass | Boundary |
|---|---:|---|
| Playwright | 1/1 fault verdict | scripted locator |
| Hybrid | 1/1 fault verdict | model emitted bounded fault |
| Pure visual | 0/1 | agent-step-budget after reaching search-results |

The repaired replay confirms the mutation was active and the visual model
repeated upward scrolling (`delta_y=-300`) without emitting a verdict. This is
now a genuine grounding/termination boundary, not a reset or milestone bug.

## Prompt + budget ablation

To separate action-direction prompting from budget effects, a diagnostic block
used an explicit positive-scroll instruction and an 18-step budget. The model
eventually reached the bottom card where `Framed Poster` was visible, but still
did not emit `fault` before the budget. It alternated one initial upward scroll
with repeated downward scrolls and never terminated. This suggests a model
decision/termination limitation for the pure-visual fault oracle, even after
the runner fix; it remains a conditional diagnostic finding, not a universal
claim about CUA.

The ablation is intentionally excluded from the primary arm and repetition
freeze. Both matched blocks retain complete replay frames and immutable
run-records.
