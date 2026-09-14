# Study-design implementation gap audit v1.0

Date: 2026-09-14

Authority: `code/config/study-design-contract.v1.0.json`

Result: **not ready for new evaluated runs**

This audit distinguishes a sound design decision from an implementation that
already enforces it. Existing contract tests are useful, but the current local
pilots were built for the superseded application-first design and are not
automatically valid under the new benchmark-first protocol.

## G1 — Pure-visual control loop receives harness progress tokens

Current agent runners construct `progressToken` values from `page.url()` and
internal milestone labels. The driver uses this token when deciding whether a
repeated click represents progress. Even if the token is not placed in the
model prompt, it changes the behavior of the CUA control loop using information
that a screenshot-only system would not have.

Required repair: the new pure-visual runner may detect change only from the
admitted screenshot/cursor/action-error history. URL or harness milestone state
must not affect planning, retry, loop detection, termination, or budget.

Consequence: existing visual runs remain diagnostic; they are not grandfathered
into the redesigned confirmatory denominator.

## G2 — Hybrid structure needs one canonical projection

Current local runners independently build page-structure lists. They generally
filter visible controls and create target IDs, but the field set and extraction
logic are runner-specific.

Required repair: implement one shared projection that emits only visible and
interactable elements with ephemeral IDs, role, accessible name, user-visible
value/placeholder, allowed accessibility states, and visible bounding box. It
must recursively reject HTML, selectors, stable application IDs, hidden text,
network/evaluator fields, and application-specific milestone state.

## G3 — Run records lack official-benchmark provenance

The current v0.1/v0.2 records identify local application/task/condition and
configuration provenance, but the redesigned unit requires stronger lineage.

The next schema must require:

- benchmark ID and pinned release/version;
- official task ID;
- digest of the verbatim official instruction;
- digest of the unchanged official evaluator;
- digest of the included/excluded task-list freeze;
- information-boundary contract ID/digest;
- framework/model/script configuration digest;
- Traditional adaptation ledger and frozen script hash where applicable.

Without these fields, a record cannot prove that the three arms executed the
same official task selected before outcomes were observed.

## G4 — Official task population is not yet frozen

The three mandatory benchmarks are selected, but exact releases, licenses, and
eligible task IDs are not yet pinned. The empty CSV files under
`research/protocol/` are schemas, not evidence that screening is complete.

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

1. benchmark artifact and license pinning;
2. outcome-blind task screening and annotation;
3. boundary-conformant shared CUA/Hybrid adapters;
4. official-task Traditional adaptation workflow;
5. benchmark-provenance run-record schema;
6. small protocol pilot, power analysis, and final freeze;
7. confirmatory collection only after all hashes are recorded.
