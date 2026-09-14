# Confirmatory run-record v1.0

Schema `1.0` is the only run-record schema eligible for the redesigned public-
benchmark confirmatory ledger. It builds on v0.2 execution provenance and adds
`benchmark_provenance`, which binds each cell to:

- the benchmark identifier and exact source commit;
- the official source-task identifier and task-manifest digest;
- the official evaluator source digest;
- the benchmark-artifact manifest digest;
- the outcome-blind screening manifest digest;
- the frozen CUA/Hybrid information-boundary contract digest; and
- the blind Traditional-adaptation record digest.

All digest fields are SHA-256 hex strings; source commits are 40-character Git
SHA-1 identifiers. `task_source_id` is the benchmark's original identifier and
is not rewritten into an arm-specific task id.

This schema is deliberately stricter than the legacy local-pilot records. A
v1.0 record does **not** by itself authorize collection, mark a task eligible,
or provide an evaluator outcome. It can be emitted only after the separate G7
authorization condition has been met. Before then, schema validation and
synthetic unit tests are engineering evidence only.
