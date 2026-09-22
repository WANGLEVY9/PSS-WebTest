# Pure-visual failure repair diagnostics (2026-09-11)

## Scope and evidence status

This artifact records a bounded engineering-diagnostic rerun after the original aligned PrestaShop Pure Visual block reported `0/15`. It does **not** overwrite or relabel the original pilot ledger, and it is not confirmatory evidence or an admission-gate result. The purpose is to distinguish runner/provider obstructions from model grounding failures before repeating a matched pilot.

The original `0/15` block remains immutable. The repaired runs below are one-shot diagnostics with separate run IDs and separate JSONL records.

## Repairs applied

1. Provider-specific optimized profiles are now selected by default (`aliyun-qwen-grounded-v1`, `deepseek-flash-grounded-v1`, and `doubao-seed-2-1-pro-grounded-v1`) instead of silently falling back to the legacy profile.
2. Qwen uses the structured tool-call action mode for the visual runner rather than the incompatible textual JSON mode.
3. Doubao uses Chat Completions/tool calls with a larger output budget for the diagnostic endpoint; its prior Responses-mode `incomplete` output is retained as a failure diagnosis, not discarded.
4. The explicit-search prompt is task-parameterized and requires the visible sequence `click search -> type query -> press Enter`; fault tasks additionally require immediate `done(verdict=fault)` once the replacement is visible.
5. Browser key normalization maps both `ENTER` and `RETURN` to Playwright `Enter`. This fixes a concrete runner error observed during the first Qwen fault repair.

## Diagnostic outcomes

| Provider/model stratum | Condition | Run ID | Outcome | Independent oracle | Interpretation |
|---|---|---|---|---|---|
| Qwen / `qwen3-vl-flash` | clean-stable | `prestashop-qwen-visual-repaired-clean-r1` | completed, `clean` | passed | repaired clean path |
| Qwen / `qwen3-vl-flash` | functional-fault | `prestashop-qwen-visual-repaired-fault-r3` | completed, `fault` | passed | repaired fault path; earlier r1 hit `RETURN` mapping and r2 reached the fault but failed to emit the verdict |
| DeepSeek / `DeepSeek-V4.1-Flash` | clean-stable | `prestashop-deepseek-visual-repaired-prompt-r1` | completed, `clean` | passed | explicit sequence reduced repeated-search grounding loop |
| DeepSeek / `DeepSeek-V4.1-Flash` | functional-fault | `prestashop-deepseek-visual-repaired-fault-r2` | completed, `fault` | passed | stronger immediate fault termination was required; r1 remained a grounding loop |
| Doubao / `doubao-seed-2-1-pro-260628` | clean-stable | `prestashop-doubao-visual-repaired-clean-r1` | completed, `clean` | passed | Chat/tool mode removed the prior Responses-format abort in this run |
| Doubao / `doubao-seed-2-1-pro-260628` | functional-fault | `prestashop-doubao-visual-repaired-fault-r1` | completed, `fault` | passed | explicit sequence and fault termination succeeded |

The raw run records are in `artifacts/phase2/run-records/2026-09-11-*-visual-repaired*.jsonl`. The failed intermediate runs remain available and are not silently removed; they document the remaining model sensitivity and the engineering fixes that were needed.

## Diagnosis

The evidence no longer supports the claim that Pure Visual is intrinsically unable to perform this task. Each of the three provider strata has at least one clean and one isolated-fault diagnostic success after protocol/runner repair. At the same time, the evidence also does not support claiming that Pure Visual is reliable: Qwen and DeepSeek each required retries or stronger grounding instructions, and the first attempts still failed for distinct reasons (key mapping, post-fault continuation, and repeated-click grounding loops).

The most defensible current conclusion is therefore **mixed causality**:

- Doubao's original failures were substantially an endpoint/protocol issue (`Responses` returned an incomplete answer without a usable action), not a demonstrated visual-capability limit.
- Qwen had both an engineering issue (the `RETURN` key mapping) and a prompt/action-grounding issue.
- DeepSeek reached the right page but repeatedly selected the same control until the task budget expired; explicit action sequencing and termination improved the diagnostic path, but one-shot success is not a reliability estimate.

## Gate decision

`GO` for a repaired pilot rerun, `NO-GO` for confirmatory collection. Before freezing repetitions, repeat the repaired configuration over the preregistered matched cells with the same reset, task, condition, oracle, and budget controls used by the original block. Report provider aborts, grounding loops, protocol failures, and runner failures separately. Do not pool the repaired diagnostics with the original `0/15` denominator.

## Verification

- Contract suite after the repair: `119/119` tests passed.
- JavaScript syntax check for `run-prestashop-agent-cell.mjs`: passed.
- The isolated database oracle passed for every listed successful diagnostic, and the agent did not receive that oracle state.
