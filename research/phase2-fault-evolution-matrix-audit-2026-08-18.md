# Phase 2 fault/evolution matrix audit (2026-08-18)

This document is an implementation audit, not confirmatory evidence.  A
condition may enter matched data collection only after its clean counterpart,
mutation application, independent oracle, reset, and removal have each passed
the gates below.

## Conditions

| SUT | ID | Type | Mechanism | Expected independent-oracle result | Status |
|---|---|---|---|---|---|
| BookStack | `bookstack.persistence-mismatch` | functional fault | reversible MySQL `BEFORE UPDATE` trigger, scoped to the study page | persisted title/body hash mismatch | smoke-tested previously |
| BookStack | `bookstack.layout-v1` | behavior-preserving evolution | browser-context CSS only | clean persisted-state oracle remains true | smoke-tested previously |
| Indico | `indico.event-title-mismatch` | functional fault | reversible PostgreSQL `BEFORE INSERT OR UPDATE OF title` trigger, scoped to exact study title | relational oracle returns `matches=0`; visible page must not be scored as clean | harness implemented; live gate pending |
| Indico | `indico.layout-v1` | behavior-preserving evolution | browser-context CSS only; no DOM/ARIA changes | clean relational and visible-page assertions remain true | harness implemented; live gate pending |
| Juice Shop | `juice.search-result-omission` | functional fault | Playwright route interception removes exactly one named product while preserving HTTP/schema | visible UI oracle fails; REST oracle is recorded as a diagnostic, not the sole verdict | harness implemented; live gate pending |
| Juice Shop | `juice.layout-v1` | behavior-preserving evolution | browser-context CSS only; no DOM/ARIA changes | clean visible UI oracle remains true | harness implemented; live gate pending |

The two Juice Shop conditions and two Indico conditions are deliberately
minimal.  They do not alter agent observations directly, and no mutation label
or evaluator result may be included in visual or hybrid observations.

## Reproducible application/removal

Indico fault (after a clean reset and before the task):

```bash
npm --prefix code run fault:indico:apply
# run exactly one task batch, then score with the independent oracle
npm --prefix code run fault:indico:remove
```

The trigger changes only rows whose incoming title is exactly
`PSS Phase2 Event`; removal must be followed by a clean reset before the next
condition.  A run is invalid if the trigger application/removal command fails,
or if the database contains a row with `[FAULT]` before the fault arm starts.

Juice Shop route and layout mutations are page/context-scoped JavaScript
installers in `code/src/mutations/juice-shop.mjs`; they are installed before
navigation and disappear when the browser context closes.  The omission
mutation preserves response status and JSON shape, and removes exactly
`Apple Pomace` by default.  The route must be installed before opening the
search UI, otherwise the run is invalid.

Indico and Juice Shop layout mutations are presentation-only.  Their CSS
selectors may fail to match a future version; that is a mutation-application
failure, not a passing clean run.  The harness must record a mutation marker in
the evaluator-side run record while keeping it out of agent observations.

## Admission gates for each condition

1. **Clean gate:** reset the SUT, run the traditional Playwright task, and pass
   the independent oracle for at least 3 consecutive repetitions.
2. **Apply gate:** apply one mutation, verify its marker (database trigger or
   route interception), and run one traditional task.  The intended fault must
   flip the independent oracle; an evolution must preserve it.
3. **Removal gate:** remove the mutation, reset, and repeat the clean oracle.
4. **Isolation gate:** run an unrelated task/negative control and confirm that
   no other product/event/page is changed.
5. **Cross-arm gate:** only after 1–4 pass may the same reset snapshot and task
   intent be dispatched to visual, hybrid, and accessibility-locator arms.

At least 5 repetitions per admitted cell (SUT × condition × arm) are required
for the Phase 2 pilot; confirmatory data should use the pre-registered larger
replication count.  A failed reset, mutation application, oracle exception, or
provider timeout is an `infrastructure/unknown` run and must not be silently
converted to a test failure.

## Current evidence boundary

BookStack has the only previously smoke-tested fault/evolution pair.  The new
Indico/Juice Shop harnesses have unit/contract coverage, but no live mutation
gate has been claimed here because the Docker services were not available in
this audit environment.  Therefore the manifest remains `provisional` and
Phase 2 remains open until the live gates are executed and their run records
are archived.

