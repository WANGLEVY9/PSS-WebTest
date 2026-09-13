# Indico/Juice Shop profile-propagation ablation (2026-09-13)

## Purpose and evidence boundary

This is a bounded engineering-diagnostic pilot, not an admission or confirmatory
collection. It tests whether the Indico and Juice Shop matched orchestrators
actually pass the provider-specific optimization profile to the child agent
runner. The observations are therefore interpreted as a protocol/runner
ablation, not as a model ranking.

## Root cause found

The matched orchestrators computed a provider-specific optimization profile, but
the child processes could receive no `PSS_AGENT_PROFILE` (Indico) or only the
non-canonical `CUA_AGENT_PROFILE` alias (Juice Shop). The child runners then
defaulted to the historical `baseline-v0` profile. For hybrid this means
`coordinate` action mode, while the intended grounded pilot profile declares
semantic candidate-id actions. A malformed or unsupported hybrid action was
therefore attributable to the runner/profile boundary before it could be
interpreted as a CUA capability result.

## Repair

- Resolve the optimization profile from the frozen provider/model manifest when
  no explicit profile is supplied.
- Pass `PSS_AGENT_PROFILE` to every Indico and Juice Shop child arm.
- Accept `CUA_AGENT_PROFILE` as an explicit child-process alias in the shared
  resolver, while preserving `PSS_AGENT_PROFILE` as the canonical provenance
  field.
- Preserve explicit `baseline-v0` selection for future matched ablations.
- Add a contract test covering alias resolution.

The repair is in `code/scripts/indico-matched-pilot.mjs`,
`code/scripts/juice-shop-matched-pilot.mjs`,
`code/src/agent-optimization.mjs`, and
`code/tests/contracts/agent-optimization.test.mjs`.

## Bounded post-repair runs

Each row is one reset-isolated, clean-stable three-arm block with one
repetition. The independent oracle remains authoritative and a cell is strict
success only when the protocol completed and the oracle passed.

| Application/provider | Playwright | Hybrid | Pure visual | Hybrid failure boundary | Visual failure boundary |
|---|---:|---:|---:|---|---|
| Indico / Aliyun Qwen3.7-Flash | 1/1 | 0/1 | 0/1 | completed + verdict, independent oracle false (`oracle`) | `provider-format` |
| OWASP Juice Shop / Aliyun Qwen3.7-Flash | 1/1 | 0/1 | 0/1 | completed + verdict, independent oracle false (`oracle`) | `grounding-loop` |
| Indico / DeepSeek V4.1-Flash | 1/1 | 0/1 | 0/1 | completed + verdict, independent oracle false (`oracle`) | `grounding-loop` |
| OWASP Juice Shop / DeepSeek V4.1-Flash | 1/1 | 1/1 | 0/1 | strict success | `agent-step-budget` |

Both blocks produced unique run IDs and were written to the standard JSONL
ledger. Their hybrid run records report
`optimization_profile=aliyun-qwen-grounded-v1` and
`hybrid_action_mode=semantic`; this verifies that the repair reached the
runner. The Indico hybrid replay reached `/event/19/manage/`, and the Juice
Shop hybrid replay remained on the catalog route after four actions. These are
not successes because the independent task oracle did not pass.

The two DeepSeek blocks were independently audited as three-record ledgers
with three unique run IDs each. DeepSeek Juice Shop hybrid reached the search
oracle in seven actions with one retry; DeepSeek Indico hybrid emitted a
completed verdict but did not satisfy the event oracle. The provider/model
strata remain separate and are not pooled into the earlier clean-only summary.

In the same tranche, the Indico fault apply/remove/isolation gate passed after
fixing its child `SUT_BASE_URL` propagation and the login locator contract. The
gate evidence is recorded separately in
`2026-09-13-indico-fault-gate.md`; it does not admit the application because the
evolution invariant and three-arm fault/evolution cells are still missing.

## Interpretation

The prior `provider-format` observations for these applications cannot be
pooled with the repaired runs as if they measured the same protocol: they were
collected under the legacy profile boundary. The repair removes one
engineering confound, but the post-repair hybrid failures are now split into a
task-grounding/oracle boundary rather than a malformed-output boundary. Pure
visual remains blocked by provider-format or grounding-loop behavior and needs
a separate provider/action-schema ablation.

No application is admitted or frozen by this report. Fault and UI-evolution
gates remain outstanding, and the power/repetition freeze and confirmatory
lanes remain blocked under the long-run campaign manifest.

## Next bounded branch

1. Inspect the bounded replay actions and independent-oracle deltas for the
   two repaired hybrid runs; do not infer capability from provider-format
   counts alone.
2. Run the corresponding fault and UI-evolution cells with the repaired
   profile, keeping clean/fault/evolution ledgers separate.
3. Only after the clean, fault, and evolution windows are all complete should
   the application-level admission board be recomputed.
