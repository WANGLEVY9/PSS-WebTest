# Invoice Ninja fault/evolution apply-remove-isolation gate (2026-09-12)

Evidence boundary: mutation preflight only; no agent arm was run and Invoice Ninja remains non-admitted.

| Variant | URL | visible number | edit heading | DB oracle | fault marker | layout marker |
|---|---|---:|---:|---:|---:|---:|
| baseline | /invoices/VolejRejNm/edit | 123456 | yes | pass | no | no |
| fault_applied | /invoices/VolejRejNm/edit | 999999 | yes | pass | yes | no |
| fault_removed | /invoices/VolejRejNm/edit | 123456 | yes | pass | no | no |
| evolution_applied | /invoices/VolejRejNm/edit | 123456 | yes | pass | no | yes |
| evolution_removed | /invoices/VolejRejNm/edit | 123456 | yes | pass | no | no |

## Checks

- fault_applied_visible_mismatch: **pass**
- fault_db_unchanged: **pass**
- fault_removed_restores_clean: **pass**
- evolution_applied_marker: **pass**
- evolution_semantics_preserved: **pass**
- evolution_removed_isolated: **pass**

Gate result: **PASS**

A PASS is a prerequisite for fault/evolution arm runs only. It does not admit the application, freeze repetitions, or justify confirmatory analysis.
