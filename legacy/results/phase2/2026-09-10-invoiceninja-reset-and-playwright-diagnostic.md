# Invoice Ninja expansion diagnostic (2026-09-10)

## Evidence captured

- Candidate SUT: Invoice Ninja from the local WebTestPilot compose and seed assets.
- Local lifecycle adapter: `code/scripts/webtestpilot-lifecycle.mjs invoiceninja reset`.
- Reset result: HTTP readiness passed at `127.0.0.1:8082`; seed snapshot returned five numeric table counts (`users`, `clients`, `invoices`, `payments`, `products`) of `1/1/4/1/11`.
- Scripted task: `invoiceninja-view-invoice-details` (login → open Invoices → open invoice `123456`).
- Playwright diagnostic: completed, clean visible verdict, 5 scripted actions, 1,888 ms wall time.
- Replay: 10 persisted screenshot frames plus a compact v0.1 run-record with a SHA-256 trace hash. Raw frames and ledger remain local under ignored `artifacts/`.

## Evidence boundary

This is one reset check and one Playwright diagnostic run. It is **not** a three-arm matched pilot, not an independent-oracle admission, and not confirmatory evidence. Invoice Ninja remains `candidate-unverified`; its version still needs an image digest, its independent oracle and fault/evolution mutations are not implemented in the PSS harness, and visual/hybrid adapters have not been run on this SUT.

## Next gate

Implement the Invoice Ninja independent oracle and one clean matched task adapter, then run Playwright, pure visual, and Hybrid on the same reset state. Keep the candidate out of confirmatory denominators unless all three arms and the oracle pass the admission gate.
