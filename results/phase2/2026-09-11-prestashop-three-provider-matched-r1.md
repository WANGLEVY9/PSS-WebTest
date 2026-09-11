# PrestaShop three-provider matched pilot, repetition 1 (aligned rerun)

Date: 2026-09-11  
Evidence boundary: one exploratory clean-stable repetition per provider; not an admission result and not confirmatory evidence.

## Protocol

- SUT: local PrestaShop, freshly started and seeded by the version-pinned
  WebTestPilot lifecycle (`http://127.0.0.1:8083`).
- Intent: authenticated catalog search for `Mug`, with the visible target
  product `Mug The Adventure Begins`.
- Arms: screenshot-only pure visual CUA, screenshot + declared page structure
  Hybrid, and scripted Playwright accessibility-locator baseline.
- Oracle: independent MySQL product query, hidden from the testing prompts.
- Provider strata: Qwen3.7-Flash, DeepSeek V4 vision, and Doubao Seed 2.1.
- Each provider has three records in a separate JSONL ledger. Playwright is
  repeated in each provider-labelled block for matched accounting, but has no
  provider/model value and must not be pooled across model strata without a
  preregistered baseline rule.

The first attempts before rerunning with the local browser permission were
excluded as infrastructure failures: Chromium could not start because of a
macOS `mach_port_rendezvous` permission error. They are not counted below.

## Engineering correction before the counted rerun

The first three-provider attempt exposed a ledger alignment bug: the agent
runner used `prestashop-search-product`, while the Playwright runner used
`prestashop-buyer-search-product`. The audit therefore split one intent into
two cells. Those nine initial records are retained as diagnostic artifacts but
are excluded from the counted rerun. The runner and both planning manifests
were corrected to use the benchmark-matrix task ID
`prestashop-buyer-search-product`.

After a fresh SUT reset/seed, the aligned rerun produced one cell with all
three arms present. The ledger audit returned `status: ok`, 9 unique run IDs,
and no missing-arm or duplicate-ID errors.

## Observed records

| Provider/model | Pure visual | Hybrid | Playwright | DB oracle |
|---|---|---|---|---|
| Qwen3.7-Flash | failed: `agent-step-budget` | completed | completed | 3/3 returned expected product |
| DeepSeek V4 vision | failed: `grounding-loop` | completed | completed | 3/3 returned expected product |
| Doubao Seed 2.1 | failed: `provider-format` | failed: `provider-format` | completed | 3/3 returned expected product |

The nine aligned counted records are stored locally under the ignored path
`artifacts/phase2/run-records/2026-09-11-<provider>-prestashop-matched-r1-aligned.jsonl`.
They include run-record status, arm/model provenance, action count, wall time,
trace hash, and failure category. No API key, credential, or raw provider
secret is included in the report or ledger schema.

## What this does and does not show

This repetition is useful for failure attribution: the database oracle and SUT
reset were healthy, while the agent arms exposed a step-budget boundary, a
grounding loop, and a provider-format boundary. It does not establish
provider/model success rates, arm ranking, or a general CUA-versus-Playwright
conclusion. One repetition cannot estimate variance or justify a repetition
freeze. The same task must be repeated under the planned clean/fault/evolution
conditions and across additional admitted workflows before the pilot admission
gate can open.

## Next engineering checks

1. Inspect the bounded raw provider summaries for Qwen and Doubao to determine
   whether their output adapters need a format-only repair; preserve the
   current failure records rather than relabelling them as successes.
2. Keep DeepSeek visual `grounding-loop` as an agent outcome unless a replay
   audit shows a coordinate normalization or page-state instrumentation bug.
3. Run repetitions 2–3 with the same reset and record contract, then repeat
   the three-arm block under one seeded functional fault and one
   behavior-preserving UI evolution.
4. Only after those blocks pass the matched admission rules should application
   expansion, power simulation, and the 4,320-execution minimum cohort begin.
