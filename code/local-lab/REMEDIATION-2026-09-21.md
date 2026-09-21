# Diagnostic runner remediation (v4 / v5)

Status: engineering verification, NOT benchmark success evidence. No confirmatory admission.

## Verified pre-change defects

- v3 records used qwen3-vl-flash despite CUA_MODEL=qwen3.7-flash.
- In v3, 5/10 agent first post-click observations preceded the review AJAX completion (182–853 ms). Playwright waited for a review element; the agents waited 600 ms.
- Hybrid: two malformed JSON responses and one stale observation-local target in five runs. No provider HTTP error or timeout in its 24 combined visual/hybrid requests.
- Correctly loaded frames also show incorrect rating filtering and incomplete traversal. Not all failures are infrastructure failures.
- Original evaluator may throw when a nonempty answer encounters a null results schema. Such errors may depend on the answer and must not automatically be removed as external infrastructure exclusions.

## Versioned changes

1. Resolve PSS_LOCAL_MODEL (explicit override), then CUA_MODEL; no implicit model fallback. Console and runner agree; requests record requested/returned model and provider request ID (null if absent).
2. Screenshot-only observation cadence: minimum 2000 ms, 750 ms unchanged bytes, 250 ms sampling, maximum 6000 ms. Every sample is persisted. No DOM, URL, network state, gold or task-specific selector drives Visual timing. **Quiet pixels do not prove semantic readiness**: content delayed beyond the observation window remains possible. This is a mitigation for measured delays, not a universal environment gate.
3. Hybrid brackets control extraction with screenshots; if pixels change, discard the control pairing and observe again (consuming a decision). IDs include observation prefixes. Controls remain the existing visible-control allowlist; no silent expansion to full AX/DOM content.
4. Preserve the two preceding observation screenshots plus model-authored notes. No observer URLs or evaluator fields enter the prompt. Input frame files and exact prompt are logged.
5. Validate actions before execution. Invalid JSON/fields/stale IDs receive explicit feedback for at most two consecutive recovery attempts, then terminate on the third invalid response. All attempts count toward 24 decisions, 240 s wall time, tokens and costs. No automatic HTTP retries; no guessed JSON repair; no retry of an ambiguously executed action.
6. Require a proposed answer to be confirmed after a fresh observation. This checks neither a gold answer nor DOM state; it is not guaranteed to correct erroneous answers.
7. Preserve the original evaluator. Retain execution failure separately from evaluator issues; no relabeling of old records, dropping errors or hidden answer correction.
8. Describe the baseline accurately: role + CSS locators/public rating attributes, not accessibility-only. Official baseline/framework replication remains a separate unmet gate.
9. Block API batches by default. Explicit diagnostic enablement uses PSS_LOCAL_ALLOW_DIAGNOSTIC_RUN=1. A run ID with an existing snapshot is rejected.
10. v5 adds strict JSON Schema for the explicitly supported Qwen3.7-Flash family, including action enums, typed coordinates and current target-ID enums. Qwen3-VL keeps JSON Object mode. API rejection never triggers a silent fallback. Removing unused null fields is canonicalization; missing action or string/array coordinates are never guessed/coerced.

## Evaluation plan and limits

- Keep v1/v2/v3 artifacts immutable; v4 is a bundled diagnostic protocol, not a clean model-only causal contrast.
- First run pure offline contract tests and a synthetic delayed-render Chromium regression (no benchmark scoring or external API).
- Next, predeclare a bounded development-only block, inspect all observations/actions/native evaluations, and compare model variants with the SAME v4 protocol. The already exposed seven tasks remain development tasks.
- A v4 vs v3 change bundles model selection, timing, memory and recovery: report them as such, or run explicit single-factor ablations before attributing changes.
- v4 diagnostic task 167: Qwen3.7 was verified in the returned model field. Both agents failed action contracts, script passed. Hybrid returned the matching title without an action field; Visual emitted array/string coordinates. Preserve these failures. A separately versioned v5 run tests strict schema, not benchmark-wide performance.
- No repeated benchmark collection until environment/reset/evaluator and independent task screening gates pass. VWA and ATA remain unintegrated for execution.
- Do not make the admission gate depend on an agent's high task success rate. Require correct interfaces, evidence completeness and boundary conformance instead.

## Local verification

From code/: `node --test local-lab/*.test.mjs`. The browser regression uses a synthetic local page and no model credentials. Original benchmark results are verified separately with `node local-lab/validate-benchmark.mjs` (without export).

## Executed diagnostic evidence

2026-09-21: local suite **30/30** and existing contracts **287/287** passed. Chromium regression reproduced a missing-content frame at 600 ms and observed delayed content using the new cadence. This is a synthetic engineering test, not benchmark success evidence.

| Protocol / task 167 only | Visual | Hybrid | Playwright |
|---|---|---|---|
| v4 (Qwen3.7, JSON Object) | failed: action contract | failed: missing action field | official pass |
| v5 (same model, strict schema) | failed: 24-decision budget | official pass | official pass |

v5 made 27 model requests (24 Visual, 3 Hybrid), with zero action-contract errors. Hybrid's repeated done answer passed the untouched official evaluator. Visual repeatedly used click (695,431) in the normalized contract and negative scroll deltas while describing downward scrolling; the schema cannot correct grounding or semantic action errors. Do not flip scroll signs or reinterpret coordinates after seeing a failure. Next calibration must explicitly test coordinate units and scroll direction on non-benchmark fixtures, then freeze any revised schema descriptions/prompt as a new protocol. No claim that Visual's remaining failures are solely model limitations.

These are two bounded diagnostic runs, six executions of one already exposed task, not independent confirmatory replications. The v4 failures and all older records remain intact. No VWA/ATA admission or evaluator patch is claimed. The console displays the selected historical model separately from the next configured model and disables collection by default.
