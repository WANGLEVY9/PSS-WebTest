# Study-design implementation gap audit v1.0

Date: 2026-09-14

Authority: `code/config/study-design-contract.v1.0.json`

Result: **not ready for new evaluated runs**

This audit distinguishes a sound design decision from an implementation that
already enforces it. Existing contract tests are useful, but the current local
pilots were built for the superseded application-first design and are not
automatically valid under the new benchmark-first protocol.

## G1 — Pure-visual progress side channel remediated; adapter audit remains

The former `progressToken` path, constructed from `page.url()` and internal
milestone labels, has been removed from the CUA driver and repaired local
runners. Repeated-action control now uses admitted screenshot digest plus the
agent's own accepted-action history; URL and milestone state are rejected by
the observation contract.

Remaining gate: every future benchmark adapter must pass the same conformance
and adversarial-leak tests. The repair is implementation evidence, not a
retroactive repair of historical local records.

Consequence: existing visual runs remain diagnostic; they are not grandfathered
into the redesigned confirmatory denominator.

## G2 — Canonical Hybrid projection implemented; extraction adapters pending

`hybrid-projection.mjs` now accepts only an allowlisted visible-interactable
projection with ephemeral target IDs, role, accessible name, visible
value/placeholder, bounded states, and visible bounding box. It recursively
rejects HTML, selectors, stable application IDs, URLs, hidden text,
network/evaluator fields, and application-specific milestone state.

Remaining gate: benchmark-specific extractors must feed this one projector and
pass its bounded-field tests. Historical local projection data remain pilot
engineering evidence only.

## G3 — Confirmatory run-record v1.0 is implemented; wiring remains

Schema `1.0` is now implemented and requires benchmark ID/source commit,
official task-source ID, official task/evaluator digests, artifact-manifest,
screening, boundary-contract, and Traditional-adaptation digests. It retains
the v0.2 reset/configuration/trace provenance and rejects undeclared fields.

Remaining gate: no official benchmark adapter or ledger writer is wired to the
schema yet, and its referenced screening/adaptation digests cannot exist until
G4/G5 complete. Schema unit tests are not study observations.

## G4 — Official task population is not yet frozen

The three mandatory sources are now pinned and locally source-inventoried:
WebArena-Verified has 812 raw source records, VisualWebArena has 910 across
its three VWA files, and ATA has 112 test cases. The ATA Zenodo archive matches
its published MD5. These are raw inventories, **not** eligible-task counts.
The empty CSV files under `research/protocol/` remain schemas, not evidence
that screening is complete.

Required repair: obtain the official artifacts, compute task inventories,
screen every task using IC1–IC7/EX1–EX8, independently review and adjudicate,
then hash the frozen tables.

## G5 — Traditional adaptation is not yet auditable

Existing Playwright scripts were written for local pilot tasks. They do not
carry an official-instruction digest, a standardized authoring-cost record,
two-person semantic-equivalence review, or a frozen script hash linked to an
official task.

Required repair: implement the adaptation ledger, review checklist, black-box
conformance gate, and hash freeze. A post-freeze failure to author or conform a
script stays in the Traditional denominator.

## G6 — Study-created fault/evolution conditions are outside the new core

The local mutation harnesses are valuable stress and engineering tests. They
are not official conditions in the selected public benchmark population.

Required repair: remove them from confirmatory scheduling. Maintenance and
repair become confirmatory only if a selected benchmark provides an official
mutation, passing/failing test pair, or version transition. The ATA benchmark's
official passing/failing cases remain valid because they are part of its
published task population.

## Resume decision

No model choice, provider backfill, repetition increase, or application
expansion closes these gaps. Work resumes in this order:

1. local benchmark environments, evaluator semantics audit, and reset gate;
2. outcome-blind task screening and annotation;
3. benchmark adapter conformance against the repaired CUA/Hybrid boundaries;
4. official-task Traditional adaptation workflow;
5. wire the v1.0 record schema and append-only ledger;
6. small protocol pilot, power analysis, and final freeze;
7. confirmatory collection only after all hashes are recorded.
