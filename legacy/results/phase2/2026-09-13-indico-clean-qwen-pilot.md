# Indico clean create-event pilot — 2026-09-13

Evidence boundary: one Qwen matched repetition; pilot only. The first matched
controller attempt exposed an over-broad BookStack title guard that incorrectly
matched Indico's event-title field; that Hybrid record is treated as an
engineering-invalid diagnostic and is not pooled as model evidence.

After scoping the guard to explicit BookStack/page-title intents, the
three-arm evidence was:

| Arm | Result |
|---|---:|
| Playwright | 1/1 |
| Pure visual | 0/1, grounding-loop |
| Hybrid | 0/1, grounding-loop |

Indico reset produced digest
`1ceb32dc749673dbbeaf7cff591f11b335419191cfdc3c568f889195e901be2d`, and the
independent relational event oracle was reachable. The visual trace repeated
header/create controls without reaching the form. The final Hybrid trace
reached the event form but repeatedly clicked the same textbox (`target_id=c73`)
instead of progressing to a valid event submission; the runner stopped
fail-closed before any event was counted. These are grounding/protocol failures,
not reset or oracle failures.

The application is not admitted. The invalidated first Hybrid record remains
visible in local artifacts for audit but is excluded from capability summaries.
