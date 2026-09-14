# ATA/PinATA environment gate v0.1

The ATA/PinATA benchmark source is pinned at commit
`650b9edaa055915cb27d2498f379a66430cc3e02`. Its published evaluator resets the
remote VTaaS applications through a GitHub Actions workflow and then consumes
the Actor/Assertor orchestration status. This gate therefore separates three
prerequisites:

1. reachability of the documented Classifieds (`:9980`), OneStopShop
   (`:7770`), and Postmill (`:9999`) services;
2. a local GitHub reset credential, supplied only through
   `PSS_ATA_GITHUB_TOKEN` or `GITHUB_TOKEN` and never returned in probe output;
3. an independent, method-independent PASS/FAIL oracle audit.

Run:

```bash
npm run gate:ata
```

The gate accepts 2xx/3xx as reachable (with `redirect: manual`) but never
authorizes study execution itself. Missing services or reset credentials are
`infrastructure-gate-failed`; reachable services with an unaudited evaluator
are `evaluator-semantics-pending`. ATA remains outside the confirmatory
denominator until the independent oracle is established and the full
three-arm adapter is exercised.
