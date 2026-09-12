# BookStack create-page matched pilot gate — 2026-09-13

Evidence boundary: one Qwen repetition per condition; diagnostic/admission
pilot only. No confirmatory denominator is created.

## Inputs and artifacts

- Provider/model: Alibaba compatible endpoint, `qwen3.7-flash`.
- Agent profile: `aliyun-qwen-grounded-v1`.
- Arms: accessibility-locator Playwright, pure visual, semantic Hybrid.
- SUT reset digest: `6246d6dbf78bf96557b59bdae5d4293ebf1236e6d61868139ee30ced0424257a`.
- Conditions: clean-stable, functional-fault:persistence-mismatch, and
  ui-evolution:bookstack-layout-v1.
- Raw pilot artifacts remain local under `artifacts/phase2/`; the reports and
  code are the versioned evidence. Each run emitted the standard JSONL
  run-record path.

## Matched outcomes

| Condition | Playwright | Hybrid | Pure visual | Strict three-arm block |
|---|---:|---:|---:|---:|
| clean-stable | 1/1 | 0/1 | 0/1 | 0/1 |
| functional fault | 1/1 | 0/1 | 0/1 | 0/1 |
| UI evolution | 1/1 | 0/1 | 0/1 | 0/1 |

The Playwright arm passed all three conditions with the independent persisted
state oracle. The agent arms did not pass any of the three cells in this
create-page repetition.

## Failure-boundary audit

- Clean Hybrid: protocol completed and emitted `clean`, but the independent
  persistence oracle was `unknown`; this is an oracle/state mismatch, not a
  successful completion.
- Fault Hybrid: emitted `clean` while the expected verdict was `fault`; the
  fault was applied and the cell failed at the agent-verdict boundary.
- Evolution Hybrid: emitted `fault` for a behavior-preserving evolution where
  the independent oracle observed clean; this is another agent-verdict
  boundary failure.
- Clean and fault Pure visual: repeated non-progressing click at
  `x=80,y=259`, classified `grounding-loop`; reset and fault injection were
  healthy, and the independent oracle remained unknown because the page was
  never persisted.
- Evolution Pure visual: provider request ended with `fetch failed` after two
  actions, classified `execution`; this is an external/provider transport
  boundary and must not be interpreted as visual incapability.

## Decision

BookStack remains **not admitted**. The navigation clean diagnostic after the
semantic schema repair passed 3/3, but this create-page workflow failed its
three-condition matched gate. The evidence supports a conditional failure
taxonomy (agent-verdict, oracle/state mismatch, grounding-loop, and provider
transport), not a universal ranking. Next work is to inspect the create-page
Hybrid replay around title/editor focus and to reproduce the evolution transport
failure with a bounded provider-readiness probe before increasing repetitions.
