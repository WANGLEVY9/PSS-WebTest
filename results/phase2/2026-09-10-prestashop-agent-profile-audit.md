# PrestaShop agent-profile application audit (2026-09-10)

## Scope

This audit checks the local PrestaShop agent runner only. No provider request was
made and no new run is counted as a pilot observation. The screenshot-only
visual contract and screenshot-plus-structure hybrid contract are unchanged.

## Finding

Before this change, `run-prestashop-agent-cell.mjs` resolved an optimization
profile but used the legacy hard-coded eight-step fallback for the adapter and
did not pass the profile's timeout, retry, decision-retry, coordinate, or hybrid
action settings into the driver. Consequently, selecting a profile did not
fully determine the execution protocol.

## Change

Commit `aea44b0` makes the profile effective while retaining explicit
environment overrides. The runner now derives and passes:

- adapter `max_steps`;
- post-action settle time;
- provider timeout and transport/decision retry budgets;
- coordinate mode and hybrid action mode;
- provider output-token budget; and
- wall-time budget.

The provider environment is copied without logging or exposing credentials.
The independent database oracle, reset protocol, replay recorder, and
observation contracts are untouched.

## Verification

- `node --check scripts/run-prestashop-agent-cell.mjs`: passed.
- `npm run test:contracts`: 115 passed, 0 failed.
- No external provider call was made for this audit.

This is a harness correctness repair, not evidence that pure visual or hybrid
success rates improved. A reset-isolated matched rerun is required before any
reliability or admission claim.
