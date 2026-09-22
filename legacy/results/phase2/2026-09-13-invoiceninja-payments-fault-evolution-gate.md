# Invoice Ninja Payments fault/evolution apply-remove-isolation gate (2026-09-13)

Mutation preflight only; no agent arm was run and Invoice Ninja remains non-admitted.

| Variant | URL | payment 0001 | heading | DB oracle | fault marker | layout marker |
|---|---|---:|---:|---:|---:|---:|
| baseline | /payments | 0001 | yes | pass | no | no |
| fault_applied | /payments | absent | yes | pass | yes | no |
| fault_removed | /payments | 0001 | yes | pass | no | no |
| evolution_applied | /payments | 0001 | yes | pass | no | yes |
| evolution_removed | /payments | 0001 | yes | pass | no | no |

## Checks

- fault_applied_visible_omission: **pass**
- fault_db_unchanged: **pass**
- fault_removed_restores_clean: **pass**
- evolution_applied_marker: **pass**
- evolution_semantics_preserved: **pass**
- evolution_removed_isolated: **pass**

Gate result: **PASS**

