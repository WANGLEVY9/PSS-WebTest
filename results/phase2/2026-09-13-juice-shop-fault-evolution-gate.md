# Juice Shop fault/evolution apply-remove-isolation gate (2026-09-13)

Mutation preflight only; no agent arm was run and Juice Shop remains non-admitted.

| Variant | UI oracle | expected-result count | layout marker |
|---|---:|---:|---:|
| baseline | pass | 3 | no |
| fault applied | fault detected | 2 | no |
| fault removed | pass | 3 | no |
| evolution applied | pass | 3 | yes |
| evolution removed | pass | 3 | no |

## Checks

- baseline_clean: **pass**
- fault_positive_missing_expected: **pass**
- fault_removed_restores_clean: **pass**
- evolution_preserves_semantics: **pass**
- evolution_removed_isolated: **pass**

Gate result: **PASS**

The fault mutation is browser-context scoped and the evolution mutation is presentation-only; each reset and fresh context is executed independently.
