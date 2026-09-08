# Phase 2 adapter-conformance gate v0.1

**Status:** implemented contract gate; no live provider or SUT result collected.

## Purpose

This gate establishes that a frozen configuration can be passed to a matching
adapter without observation leakage. It is deliberately narrower than clean
admission: it does not establish provider availability, task success, fault
detection, interface-evolution resilience, cost, or a strategy effect.

## Required checks

| Family | Registered configuration | Admitted input | Required rejection |
|---|---|---|---|
| Visual | `visual-pss-native-aliyun-qwen3-vl-flash-v2` | screenshot (+ viewport metadata) | page structure, DOM, oracle, mutation label |
| Hybrid | `hybrid-pss-native-aliyun-qwen3-vl-flash-v2` | screenshot + declared page structure | oracle, application state, mutation label |
| Scripted | `scripted-playwright-accessibility-human-v2` | script identifier (+ browser metadata) | agent prompt, oracle, application state, mutation label |

## Gate command and interpretation

```sh
cd code
npm run test:adapter-conformance
```

Passing this command permits a configuration to retain `implemented` status.
It does **not** change `admission.status` to `conformance-passed`; that status
requires a recorded conformance manifest against the actual adapter revision,
then a reviewer decision. A provider call is intentionally not part of this
command, so it has no token or API cost.

## Next Phase 2 gate

For each of the three reference configurations on one BookStack workflow:

1. record immutable runner/SUT/reset/environment digests;
2. run three clean matched repetitions from the same fixture and budget;
3. retain timeout, provider, reset, oracle and infrastructure failures;
4. independently audit the ledger and only then decide whether the cell is
   eligible for clean admission.
