# Official benchmark adapter contract v1.0

The benchmark adapter is the only boundary between an outcome-blind screened
source task and a runner. It requires the verbatim official instruction,
recomputes its SHA-256 digest, and matches that digest to both the pinned source
inventory and the adjudicated screening row. It also requires a frozen
screening-manifest digest and an absolute start URL.

The emitted task input contains only runnable information: benchmark/source
identity, instruction, start URL(s), site scope, login/difficulty metadata, and
the screening manifest digest. Evaluator code, expected answers, oracle state,
network traces, outcomes, and pass/fail fields are rejected recursively.

An adapter input always carries `confirmatory_authorized: false`. Formal ledger
writing remains protected by the separate authorized v1.0 writer. The adapter
therefore supports conformance testing and later pilot preparation without
silently authorizing collection.
