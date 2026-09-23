# Qwen 3.8 local WebArena-Verified diagnostic snapshot

This snapshot joins four separately preserved diagnostic audits, not a
confirmatory result. Official task IDs are **260, 261, 274, 324, 351**: two
category-navigation tasks, one search task, one search-plus-sort task and one
category-plus-sort task. The intended
matrix has seven configurations per task: one Traditional Playwright script,
Qwen 3.8 Max/Flash × AgentLab pure visual and Hybrid, and Qwen 3.8 Max/Flash ×
restricted Browser Use Hybrid. There is no Browser Use pure-visual arm.

| Source audit | Official tasks | Intended configuration-task cells | Actual process attempts | Conservative analysis-eligible cells/attempts |
| --- | ---: | ---: | ---: | ---: |
| Two-task pair | 260, 274 | 14 | 17 | 11 cells |
| Task 261 | 261 | 7 | 11 | 6 attempts; five Traditional script failures separately retained |
| Task 324 | 324 | 7 | 8 | 7 attempts; one pre-actor interpreter failure excluded |
| Task 351 | 351 | 7 | 10 | 5 attempts; provider and engineering variants retained separately |
| Total descriptive coverage | **5** | **35** | **46** | **29**, under the above conservative rules |

These are not 46 independent benchmark tasks or 35 confirmatory observations.
Three later task-351 remediation attempts are preserved in
[the engineering addendum](2026-09-23-qwen-remediation-addendum.md), followed
by one [task-324 pixel-stall diagnostic](2026-09-23-qwen-task324-stall-diagnostic.md).
They raise the descriptive process-attempt count to 50 while leaving the
number of distinct official tasks at five; the historical table above is not
rewritten.
Some processes are retries or multiple Traditional script versions. The task
261 five script failures belong to one intended Traditional configuration,
not five repetitions. The pair audit has three task-260 model-action parser
statuses held for manual adjudication, rather than silently recoded. One
task-324 Browser Use Max attempt has no native score because the wrong Python
environment was launched; its clean retry remains a separate process. Task
351 has two 30-second Max pure-visual provider timeouts, one pre-actor
allowlist rejection, and a separate 45-second timeout variant with an
output-truncated provider response.

The observed official scores are heterogeneous: task 260 has successes in
Traditional, Max visual and Max Browser Use Hybrid; task 274 has successes in
Traditional, Max visual, Max AgentLab Hybrid, Flash AgentLab Hybrid and Flash
Browser Use Hybrid; task 261 has no accepted score in the attempted
configurations; task 324 has one accepted score, Max AgentLab Hybrid; task
351 has no accepted score in the attempted configurations. These
facts describe individual diagnostic runs only. They do **not** estimate
population success rates, compare model vendors, or establish that a testing
paradigm is generally superior.

## Admission state

- The 100-task development plan is selected, but this bounded probe implements
  only five official public-navigation tasks. The other 95 are **not silently
  attempted as anonymous tasks**. Several require account/order state;
  `require_login` being absent from an extracted setup record is not proof of
  anonymous access parity.
- Targeted content reset and peer isolation were measured, but full mutable
  state closure (all relevant tables, caches, indexes, files and queues) is
  not certified. The local x86 Docker VM has 4 CPUs and 8 GiB; the observed
  per-arm fixture reset is often 150–340 seconds, so aggressive local
  concurrency would introduce a substantial infrastructure confound.
- Traditional scripts are AI-assisted diagnostic adaptations. Human-blinded,
  outcome-blind authoring is not claimed. Script failures stay in the
  deployment-effectiveness accounting; they are not used as clean evidence of
  intrinsic Playwright capability.
- The source fingerprints, retry identities and engineering exceptions are
  retained. Neither the local spending ledger's unknown charges nor pilot
  per-request estimates are presented as settled provider bills.

Accordingly `bulk_execution_authorized=false` and
`confirmatory_authorized=false` remain correct. Scaling to all 100 locally
requires task-level authentication parity, frozen Traditional adaptation and
full-state reset/isolation admission first. Running the remaining 95 with the
current anonymous five-task adapter would create misleading failures,
not valid large-scale evidence.
