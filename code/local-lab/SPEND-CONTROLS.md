# Shared API spending controls

The development acceptance budget is **CNY 1,500 total**, not a monthly refill or
an estimate that the entire planned study can finish for this amount. The ledger
is shared across batches and runtime databases on one host. These controls do
not authorize formal collection or substitute for native framework acceptance.

| Control | Default |
|---|---:|
| Warning | CNY 1,200 (80%) |
| Critical warning | CNY 1,350 (90%) |
| Stop admitting new execution identities | CNY 1,425 (95%) |
| Maximum accounted plus reserved exposure | CNY 1,500 |
| Per execution: task × configuration × round | CNY 15 |
| Model attempts per execution, including retries | 30 |
| Execution deadline | 240 seconds |
| Action ceiling | 30; the diagnostic runner's existing 24-decision cap is stricter |
| Single provider request deadline | 45 seconds, bounded by remaining task time |

`code/config/spend-policy.json` is the versioned default. It uses **8 CNY/USD as a
conservative planning assumption, not a market quote**. Verify the billing
conversion, taxes, fees and rates before a paid canary. Engineering caps are not
retrospectively imposed on historical research. Freeze the final limits equally
across compared arms, retain budget failures in the intended denominator and
report any budget-driven censoring separately from native task success.

## Configuration and scope

Set these in the private provider environment used by the console and workers:

```dotenv
PSS_SPEND_POLICY_FILE=/absolute/private/path/spend-policy.json
PSS_SPEND_DB=/absolute/private/path/shared-spend.sqlite
```

All admitted processes must point at the **same database and policy**. The default
DB is `code/artifacts/private/shared-spend.sqlite`, outside per-run directories.
Never create a fresh ledger to resume a spent budget, delete the DB/WAL, change
the path between batches, or run independent copies with the same funded key.
Use a dedicated provider project/key and provider-side enforced spend limits to
cover traffic outside this application. This is a single-host SQLite WAL design;
multiple hosts/NFS need a central request gateway before admission.

The default `rates: []` deliberately blocks paid dispatch. Each reviewed rate
entry must bind `provider`, `model`, `base_url`, `input_usd_per_million`,
`cached_input_usd_per_million`, `output_usd_per_million`, `max_input_tokens`,
`max_output_tokens`, `source`, `verified_at` and `expires_at`. Use actual authorized
API IDs, not a guessed model alias. `max_input_tokens` must cover the maximum
billable input accepted by the deployed model, including visual input and any
long-context pricing. Do not lower this number to make a reservation fit. This
deliberately conservative full-context reservation may block a CNY 15 task;
approve a verified tighter metering adapter or revise the engineering task cap
within the unchanged total cap before running it. Account for any service-tier
or long-context premium in the reviewed rates. Only text/image requests without
unpriced tools/audio/background jobs are accepted.

After the first reservation the complete policy is frozen in the ledger. Editing
the cap, FX or prices requires a reviewed migration that preserves all prior
exposure; restarting is not a migration. Before the first reservation the empty
ledger permits configuration. The frontend can pause/resume dispatch but cannot
raise limits, delete accounting or manufacture verified prices.

## What the implementation enforces

1. `provider.mjs` requires the shared guard for real fetch calls. The diagnostic
   runner provides a stable batch/record identity; `accountedProvider` accepts
   the same guard and opportunity identity. Injected test transports are only
   a unit-test seam. Legacy scripts outside this transport and direct Python
   SDK calls are **not covered**; official framework adapters remain blocked
   until their requests, including SDK retries, pass the same accounting gate.
2. A SQLite `BEGIN IMMEDIATE` transaction reserves the worst-case billable cost
   before dispatch, atomically checking total exposure, per-execution cost,
   request count, time and pause state. Unknown or in-flight cost continues to
   consume its full reservation across crashes/restarts. Task identity and
   request hashes are stored; keys, prompts and provider error bodies are not.
3. Explicit usage settles to integer micro-CNY. Missing/malformed usage or a
   different returned model remains unknown. An observed reservation overrun
   persists and locks all new requests pending investigation; pausing/resuming
   cannot erase it. This limits calculated exposure under reviewed rate bounds;
   it is not a claim that an inaccurate price card can prevent provider bills.
4. Network/timeout delivery is not automatically replayed. Billing/quota HTTP
   429 errors are terminal, unlike transient rate limits. Provider quota/auth
   failures and returned-model mismatches pause subsequent tasks globally.
5. Unknown-charge reconciliation requires an explicit final amount and a
   SHA-256 digest of billing evidence through `SpendGuard.reconcile`. Preserve
   the corresponding private evidence. There is no automatic refund or UI
   “clear cost” button. Reconciliation cannot change scientific outcomes.
6. The dashboard shows accounted cost, held reservations, available balance,
   all four thresholds, persistent deduplicated alerts and recent task usage.
   Alerts stay local; no email/webhook is sent. Ledger failure disables launch;
   browser connection loss marks displayed values stale. Pausing prevents new
   reservations; requests already reserved/in flight can still finish and bill.

Current OpenAI documentation distinguishes spend alerts from enforced spend
limits. Configure the enforced limit for the dedicated project rather than
assuming an alert alone stops traffic. Project budget API errors must not be
retried. See [OpenAI billing and spend troubleshooting](https://help.openai.com/en/articles/6614457)
and [API error codes](https://developers.openai.com/api/docs/guides/error-codes).
No provider-side account settings were changed by this implementation.

## Acceptance

The portable verifier includes the shared-budget concurrency/restart tests and
browser pause/resume, mobile layout, offline/reconnect and credential-redaction
checks. All use synthetic responses and temporary ledgers. Passing them does not
prove real model pricing, provider-side limits, framework routing, official reset
or native evaluation. Before sponsor handoff, run bounded genuine canaries with
verified rate cards and reconcile the provider invoice against both ledgers.
