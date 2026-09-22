# Indico fault/evolution apply-remove-isolation gate (2026-09-13)

Mutation preflight only; no agent arm was run and Indico remains non-admitted.

| Variant | browser workflow | independent oracle |
|---|---:|---:|
| baseline | pass | pass |
| fault apply/remove | pass | fault detected |
| evolution applied | pass | pass |
| evolution removed | pass | pass |

## Checks

- baseline_browser_and_oracle: **pass**
- fault_apply_remove_and_independent_oracle: **pass**
- evolution_browser_and_oracle: **pass**
- evolution_removed_restores_clean: **pass**

Gate result: **PASS**

The evolution mutation is browser-context scoped and presentation-only; the fault workflow uses the independent relational oracle and removes the seeded trigger in a finally path.
