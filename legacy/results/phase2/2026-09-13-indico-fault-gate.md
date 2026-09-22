# Indico fault apply/remove/isolation gate (2026-09-13)

This is a prerequisite gate for later three-arm fault cells. It is not an arm
result, an application admission decision, or confirmatory evidence.

| Check | Result |
|---|---:|
| fault trigger applied | pass |
| login → create event browser workflow | pass |
| browser-visible title mismatch (`PSS Phase2 Event [FAULT]`) | pass |
| independent relational oracle detected the expected fault | pass |
| fault trigger removed | pass |
| gate | **PASS** |

The independent oracle returned `matches=1`, `expected_fault=true`, and
`passed=true` for the seeded mismatch. The trigger was removed in the `finally`
path. The gate runner now passes `SUT_BASE_URL=http://localhost:8080` to the
Playwright child; before this repair it silently inherited the default Juice
Shop URL (`127.0.0.1:3000`) and timed out before login. The Indico login specs
also use the actual v3.3.6 placeholders because the page does not expose the
claimed accessible names.

The corresponding UI-evolution invariant and agent-arm fault/evolution cells
remain outstanding.

