# Application admission progress — 2026-09-12

Evidence boundary: feasibility/admission work only. **No application is admitted
to confirmatory collection.** `confirmatory admissions = 0` remains unchanged.

## Invoice Ninja: independent oracle implemented and verified

The previous state was one Playwright diagnostic whose verdict came from a
visible heading. A visible heading is not ground truth, so the workflow could
not have supported an admission claim.

**What was added**

- `code/src/invoiceninja-oracle.mjs` — independent oracle whose authority is the
  persisted application database (`invoiceninja-mysql-1`), not the page and not
  the arm's self-report.
- `code/scripts/evaluate-invoiceninja-invoice.mjs` — CLI wrapper
  (`npm run oracle:invoiceninja`).
- `code/scripts/run-invoiceninja-playwright-cell.mjs` — now requires
  `visibleVerdict === 'clean' && oracle.passed === true` for
  `checkpoint_reached`, and records `independent_oracle_passed` plus the oracle
  payload in the trace.
- `code/tests/contracts/invoiceninja-oracle.test.mjs` — 7 contract tests,
  including an exact-match guard (`number = '123456'`, never `LIKE`) and an
  input-escaping guard.

**Verified seeded state**

| Invoice number | status_id | amount | balance | Meaning |
|---|---:|---:|---:|---|
| `123456` | 4 | 120000 | 0 | fully paid — the oracle target |
| `123456_sent` | 2 | 120000 | 120000 | sent |
| `123456_draft` | 1 | 120000 | 0 | draft |
| `123456_past_due` | 2 | 60000 | 60000 | past due |

The sibling rows are why the oracle uses exact equality: a `LIKE '123456'`
predicate would match all four rows and could accept the wrong persisted state.

**Oracle output**

```json
{"oracle":"invoiceninja-database-invoice","authority":"independent-database",
 "invoice_number":"123456","expected":{"status_id":4,"amount":120000,"balance":0},
 "observed_rows":[{"id":1,"client_id":1,"number":"123456","amount":120000,"balance":0,"status_id":4,"is_deleted":0}],
 "passed":true,"reasons":[]}
```

**Playwright cell re-run with the independent oracle**

`status=completed`, `checkpoint_reached=true`, `independent_oracle.passed=true`,
5 scripted actions, 1723 ms.

## What still blocks Invoice Ninja admission

| Gate | Status |
|---|---|
| Local compose + deterministic reset | pass (`counts 1/1/4/1/11` on `users/clients/invoices/payments/products`) |
| Independent persisted-state oracle | **pass (new)** |
| Image/database digest pin | **blocked** — `version_pin: null`; the app image tag `5.11.61-d` is not digest-pinned |
| Fault / evolution mutation isolation | **blocked** — not implemented for this SUT |
| Pure-visual and hybrid task adapters | **blocked** — no agent-arm adapter exists for Invoice Ninja |
| Matched three-arm clean pilot | **blocked** — cannot run without the agent adapters |

The blocking item is now explicitly the **agent-arm adapter**, not the oracle.
Implementing a visual/hybrid adapter for Invoice Ninja is a bespoke effort
comparable to `run-prestashop-agent-cell.mjs`; it is the next concrete task for
this SUT.

## Wave 1 candidates

`gitea` remains **promising-but-unverified** and was not advanced this round.
Its recorded blockers are unchanged and were re-confirmed: no local compose
stack, no lifecycle/reset script, no seed fixture, no independent oracle, and no
version pin. `code/config/application-triage-queue.v0.1.json` still orders it
first in wave 1, but no wave-1 candidate can move before a local deployment
asset exists. Creating a Gitea compose stack, seed fixture, and reset path is
the prerequisite; it is a larger task than the Invoice Ninja oracle work.

## Verification

| Check | Result |
|---|---|
| `npm run test:contracts` | 138/138 pass (131 prior + 7 Invoice Ninja oracle) |
| `npm run validate:application-triage` | 22 candidates across 4 waves; admission remains closed |
| `npm run validate:application-catalog` | 22 countable candidates; confirmatory admissions = 0 |
| `npm run oracle:invoiceninja` | `passed: true` |
| `npm run pilot:invoiceninja:playwright` | `completed`, independent oracle passed |

## Next work

1. Implement the Invoice Ninja visual/hybrid task adapters, then run the matched
   three-arm clean pilot.
2. Pin the Invoice Ninja image and database digests.
3. Create the Gitea local compose stack, seed fixture, and reset/ready commands
   before any further Gitea triage.
4. Keep both applications out of every confirmatory denominator until all
   gates pass.
