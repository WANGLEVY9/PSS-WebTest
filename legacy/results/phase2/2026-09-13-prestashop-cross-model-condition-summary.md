# PrestaShop cross-model condition summary (pilot only)

Date: 2026-09-13

This table is a compact navigation aid for the latest repaired, ledger-audited
blocks. It is not a confirmatory estimate and does not pool providers or
frameworks.

| Model stratum | Workflow / condition | Visual | Hybrid | Playwright | Interpretation |
|---|---|---:|---:|---:|---|
| Qwen3.7-VL Flash | medium clean, n=2 | 2/2 | 2/2 | 2/2 | positive conditional clean stratum |
| Qwen3.7-VL Flash | medium UI evolution, n=1 | 1/1 | 1/1 | 1/1 | positive conditional evolution stratum after Playwright repair |
| Qwen3.7-VL Flash | simple isolated fault, n=1 | 0/1 strict; oracle-only | 1/1 fault | 1/1 fault | visual reached the oracle but did not terminate within 12 steps |
| Qwen3.7-VL Flash | fault grounding ablation, n=1 | 0/1 strict; oracle-only | 1/1 fault | 1/1 fault | explicit positive-scroll hint + 18 steps still did not produce a visual verdict |
| DeepSeek V4.1-Flash | medium clean, n=1 | 1/1 | 1/1 | 1/1 | valid after direct-action tool-alias adapter repair |
| DeepSeek V4.1-Flash | simple isolated fault, n=1 | 1/1 fault | 1/1 fault | 1/1 fault | visual fault detection succeeded in this task/model stratum |
| DeepSeek V4.1-Flash | medium UI evolution, n=1 | 0/1 grounding-loop | 1/1 | 1/1 | repeated non-progressing visual click; provider requests were healthy |

The contrast is exactly why the primary design retains model/provider as a
nested replication factor: Qwen and DeepSeek expose different conditional
failure boundaries on the same SUT and task families. No row supports a
universal winner claim, and n=1 or n=2 cells are insufficient for a variance or
power freeze.

Engineering fixes represented in these blocks:

1. Playwright medium task-to-workflow alignment and explicit anchor/route wait;
2. AJAX-safe PrestaShop search milestone and mutation installation;
3. bounded DeepSeek direct-action tool aliases routed through the common schema.

The original pre-repair failures remain preserved as excluded diagnostic
evidence rather than being overwritten.
