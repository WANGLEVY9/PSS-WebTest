# PrestaShop fault/evolution apply-remove-isolation gate (2026-09-10)

- **Gate status:** PASS
- **Evidence class:** platform/condition diagnostic; not a three-arm matched pilot or confirmatory result.
- **Base URL:** `http://localhost:8083`
- **Mutations exercised:** 2/2
- **Independent database oracle unchanged:** yes
- **Infrastructure error:** none

| Mutation | Condition | Baseline target | Applied state | Removed target | Isolated target | Result |
|---|---|---:|---|---:|---:|---|
| search-result-label-omission | functional-fault | true | target=false, replacement=true, count=5 | true | true | pass |
| search-layout-preserving-v1 | ui-evolution | true | target=true, replacement=false, count=5 | true | true | pass |

- **Database rows before:** [{"id_product":15,"name":"Pack Mug + Framed poster"}]
- **Database rows after:** [{"id_product":15,"name":"Pack Mug + Framed poster"}]
- **Wall time:** 3796 ms

A PASS is only a prerequisite for later arm-specific fault/evolution runs. It does not admit PrestaShop into the benchmark or justify repetition/power decisions.
