# Variant-aware ledger audit (2026-09-14)

The descriptive ledger summary and cross-application admission audit now use the same execution-variant stratum as the pilot-input and power planners. Strict provider-format, bounded JSON repair, and framework-specific records are not collapsed into a provider/model-only group.

Current recursive, de-duplicated audit: **4,312 valid records**, **158 invalid records**, **140 duplicate `run_id` copies excluded**, and **336 variant-aware summary groups**. Application admission is unchanged and fail-closed: Juice Shop is the only pilot-admission candidate; BookStack, Indico, Invoice Ninja, and PrestaShop remain blocked by workflow breadth and/or other declared gates.

This is a reporting-contract correction, not new confirmatory evidence. The all-history audit and the explicit reset-complete planning views remain separate artifacts.

Artifacts:

- [variant-aware ledger summary](2026-09-14-phase2-ledger-summary-variant-aware-v1.json)
- [variant-aware admission audit](2026-09-14-phase2-application-admission-audit-variant-aware-v1.json)
