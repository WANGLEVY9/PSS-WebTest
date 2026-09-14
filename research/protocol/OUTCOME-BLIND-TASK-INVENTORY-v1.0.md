# Outcome-blind task inventory v1.0

The inventory generator exports only source-task identity, verbatim-instruction
digests, site/start-url metadata, login/difficulty metadata, and source file
lineage. It intentionally excludes evaluator configurations, expected values,
arm outcomes, and eligibility decisions.

The current pinned source inventory is 1,834 records: 812 WebArena-Verified,
910 VisualWebArena, and 112 ATA/PinATA test-case blocks. These counts are
source records, not the confirmatory denominator. A task becomes eligible only
after the outcome-blind dual-screening, independent adjudication, and frozen
included/excluded manifests required by the study contract.

Run:

```bash
npm run inventory:benchmark:outcome-blind
```

The generated JSON is written under the ignored local benchmark-artifact cache;
it is not itself a result ledger or a confirmatory dataset.
