# Application registry expansion validation (2026-09-10)

## Scope

This round expands the registered application candidate pool and reserves a common task design. It does not run application SUTs and does not create empirical observations.

## Counts after the change

- Benchmark registry rows: 25 (5 rows with local workflow implementations + 20 candidate-only rows).
- Countable candidate applications in the expansion catalog: 22.
- Candidate workflow slots: 22 applications × 8 reusable slots.
- Applications admitted/frozen for confirmatory collection: 0.
- Confirmatory execution authorization: blocked.

The 20 new registry rows are explicit `candidate` rows with empty executable workflow arrays and a reference to `application-workflow-blueprints.v0.1.json`. This prevents them from being mistaken for runnable tasks while making the intended expansion auditable.

## Validation evidence

```text
npm run validate:application-catalog
Application expansion catalog validation passed: 22 countable candidates, 4 cross-application task families, confirmatory admissions=0.

npm run validate:application-workflows
Application workflow blueprint validation passed: 22 countable applications × 8 candidate workflow slots; no slots admitted.

npm run validate:benchmark-matrix
Benchmark matrix validation passed: 25 applications, 40 workflows, 5 model strata, 5 traditional baselines.

npm run validate:large-scale-expansion
declared_applications=25/30; admitted_or_frozen_applications=0/30; ready_for_execution=false

npm run test:contracts
112 tests passed; 0 failed.
```

## Next gate

The next implementation step is a triage queue, not a bulk run: select one new candidate with a feasible self-hosted deployment, pin its version/digest, prove deterministic reset and seed, implement an independent oracle, and only then attempt a three-arm matched pilot. The existing confirmatory denominator remains unchanged.

