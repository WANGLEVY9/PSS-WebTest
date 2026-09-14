# VisualWebArena environment gate v0.1

VisualWebArena requires four independently reachable services before any arm
can run: Classifieds (`:9980`), Shopping (`:7770`), Reddit (`:9999`), and the
benchmark homepage (`:4399`). The gate also requires a configured Classifieds
reset token, but never sends or persists that token.

Run:

```bash
npm run gate:visualwebarena
```

Every service must return HTTP 2xx/3xx and the reset token must be configured.
Missing services, connection errors, 5xx responses, and missing reset material
are classified as `infrastructure-gate-failed`; they are not arm failures and
do not enter any denominator. Even a passing probe reports
`study_execution_allowed: false` until task screening, evaluator separation,
and the remaining manifest gates are frozen.
