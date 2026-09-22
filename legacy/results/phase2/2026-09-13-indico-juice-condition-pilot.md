# Indico/Juice Shop condition-aware matched pilot

**Date:** 2026-09-13
**Evidence boundary:** T1 condition pilot / diagnostic evidence only.
**Authorization:** No application admission, repetition freeze, power freeze, or confirmatory collection is authorized by this block.

## Scope

This tranche exercises the newly wired `clean-stable` / `functional-fault` / `ui-evolution` condition contract on two local SUTs (Indico and OWASP Juice Shop), two image-capable providers (Alibaba Qwen3.7-Flash and DeepSeek V4-Flash-Vision-Exp), and the three matched arms (Pure visual, Hybrid, and accessibility-locator Playwright). It contains one independent reset per arm and condition, for 24 records total. The clean baseline is retained in the earlier long-run blocks; this report focuses on the two non-clean conditions and therefore does not estimate false-positive/false-negative rates.

Every block used a provider-separated ledger and a fresh reset. Indico fault/evolution mutations and Juice Shop fault/evolution mutations were removed after each arm and were covered by the previously passing apply/remove/isolation gates. The independent oracle is not the agent verdict; a completed agent verdict with a failed oracle remains a failure.

## Observed strict outcomes

`x/1` is the number of strict end-to-end successes in the one-repetition block. `grounding-loop` means the visual arm did not reach a valid completion protocol; `oracle` means the agent emitted a verdict but the independent oracle did not confirm the intended state.

| SUT | provider/model | condition | Pure visual | Hybrid | Playwright |
|---|---|---|---:|---:|---:|
| Juice Shop | Qwen3.7-Flash | functional fault | 0/1 (grounding-loop) | 0/1 (agent-step-budget) | 1/1 |
| Juice Shop | Qwen3.7-Flash | UI evolution | 0/1 (grounding-loop) | 0/1 (oracle) | 1/1 |
| Juice Shop | DeepSeek V4-Flash-Vision-Exp | functional fault | 0/1 (grounding-loop) | 1/1 | 1/1 |
| Juice Shop | DeepSeek V4-Flash-Vision-Exp | UI evolution | 0/1 (grounding-loop) | 1/1 | 1/1 |
| Indico | Qwen3.7-Flash | functional fault | 0/1 (grounding-loop) | 0/1 (oracle) | 1/1 |
| Indico | Qwen3.7-Flash | UI evolution | 0/1 (grounding-loop) | 0/1 (oracle) | 1/1 |
| Indico | DeepSeek V4-Flash-Vision-Exp | functional fault | 0/1 (grounding-loop) | 0/1 (oracle) | 1/1 |
| Indico | DeepSeek V4-Flash-Vision-Exp | UI evolution | 0/1 (grounding-loop) | 0/1 (oracle) | 1/1 |

Across these 8 one-repetition blocks, Playwright is 8/8, pure visual is 0/8, and Hybrid is 2/8. These are descriptive pilot counts, not estimates of population performance. In particular, the Hybrid contrast between Juice Shop and Indico is a reason to retain SUT and workflow as random effects rather than to claim that one strategy dominates.

## Interpretation and next gate

The condition wiring is now exercised end to end: the same condition identifier reaches the mutation, the arm prompt/protocol, the run record, and the independent oracle. The current data nevertheless leave the primary admission gate closed because there is only one repetition per non-clean cell, the pure-visual arm has no valid completion in this tranche, and the Hybrid outcome is SUT/provider dependent. The next engineering step is failure triage (replay traces, request latency, action budget, and oracle state) followed by a fresh clean + fault + evolution pilot with enough repetitions to estimate variance. Only after a pre-specified three-arm admission gate passes may repetition counts be frozen and confirmatory collection begin.

## Reproducibility artifacts

- `artifacts/phase2/indico-three-arm-aliyun-qwen3.7-flash-phase2-condition-fault-indico-qwen-20260913-records.jsonl`
- `artifacts/phase2/indico-three-arm-aliyun-qwen3.7-flash-phase2-condition-evolution-indico-qwen-20260913-records.jsonl`
- `artifacts/phase2/indico-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-condition-fault-indico-deepseek-20260913-records.jsonl`
- `artifacts/phase2/indico-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-condition-evolution-indico-deepseek-20260913-records.jsonl`
- `artifacts/phase2/juice-shop-three-arm-aliyun-qwen3.7-flash-phase2-condition-fault-juice-qwen-20260913-records.jsonl`
- `artifacts/phase2/juice-shop-three-arm-aliyun-qwen3.7-flash-phase2-condition-evolution-juice-qwen-20260913-records.jsonl`
- `artifacts/phase2/juice-shop-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-condition-fault-juice-deepseek-20260913-records.jsonl`
- `artifacts/phase2/juice-shop-three-arm-deepseek-deepseek-v4-flash-vision-exp-phase2-condition-evolution-juice-deepseek-20260913-records.jsonl`
- `results/phase2/2026-09-13-indico-juice-condition-metrics-summary.json`
