# PrestaShop complex search-revisit pilot — 2026-09-13

Evidence boundary: one matched repetition per frozen model stratum; pilot only.

Task: search for `Mug`, open the exact target product, navigate back to the
search results, and reopen the same product. The cell requires the second
product-detail milestone and an independent database oracle.

| Model stratum | Playwright | Pure visual | Hybrid |
|---|---:|---:|---:|
| Qwen3.7-Flash | 1/1 | 0/1 | 1/1 |
| DeepSeek V4.1-Flash | 1/1 | 0/1 | 0/1 |

Failure-boundary details:

- Qwen visual reached the target state but emitted an out-of-viewport pointer
  (`x=1059,y=720`) before protocol completion. This is provider-format, not a
  reset/oracle failure; the taxonomy now records it as such.
- DeepSeek Hybrid reached the target product state and independent oracle
  success, but repeated a textbox click (`target_id=c9`) and failed protocol
  completion. This is a grounding-loop false negative, not SUT failure.
- DeepSeek visual repeated a non-progressing product click (`x=833,y=125`)
  and was classified as grounding-loop.

All resets were seed-verified and all database oracles were reachable. The
longer workflow therefore exposes a conditional stability trade-off: Hybrid
can preserve target selection under Qwen but may fail on revisit/focus control;
pure visual can reach the state but is sensitive to coordinate bounds and
repeated visual clicks. These are model/profile-specific pilot findings, not a
universal ranking.
