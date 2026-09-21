# Official benchmark expansion and admission plan

## Material Passport

- Origin Skill: academic-research-suite / experiment-agent
- Origin Mode: plan and authorized implementation
- Origin Date: 2026-09-21
- Verification Status: PARTIAL — live integration evidence only
- Version Label: official-expansion-v1

## Objective and fixed boundaries

Compare where pixel-only CUA, screenshot-plus-visible-structure Hybrid, and deterministic scripts work or fail. No directional superiority hypothesis is assumed. Preserve the approved core (WebArena-Verified, VisualWebArena, ATA) and conditionally gated WorkArena++; this implementation plan does not silently amend the design contract.

Environment availability, adapter execution, valid official scoring, and confirmatory admission are **four different states**. A small runnable slice does not admit an entire benchmark. The included/excluded/adaptation ledgers currently remain header-only. No automated audit substitutes for two independent reviewers.

## Work packages and acceptance

| Order | Work                                   | Acceptance / stop condition                                                                                                                                                                                                                                                                                               |
| ----- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | WAV broadened read-only integration    | Freeze all five template-136 tasks (163–167), run each strategy once, persist images/HAR/responses/native results; retain every failure. No success-based task removal.                                                                                                                                                   |
| 2     | Provider and action protocol hardening | Categorize invalid JSON, invalid target ID, deadline, incomplete traversal, wrong answer and evaluator exception separately. Before the next version, fix only general interface problems using development tasks; record changes and a 30-request/interface contract soak, without using success as admission criterion. |
| 3     | VWA official local deployment          | Verify official archive checksum, isolate Classifieds compose/database/loopback port, pin actual image digests, verify fixtures, then apply-reset-replay three times. Do not relabel WAV's port 7770 as VWA.                                                                                                              |
| 4     | VWA input/evaluator adapter            | Site-scoped IDs; preserve official task images (not just browser screenshots); pin image digests and upstream evaluator. Classify any VLM-based evaluator dependency and prohibit its outputs from entering agent context. Start a preselected small slice only after its dependency closure works.                       |
| 5     | ATA artifact and label contract        | Separate actions/expected assertions from P/F labels, annotated failing step and source filenames. Compare scorer semantics with upstream. Resolve source-count and duplicate-step anomalies before population revision. Environment must reproduce published labels; never use agent verdict as gold.                    |
| 6     | Screening and fair script adaptation   | Freeze eligible set with two independent reviewers and adjudication before formal arms. Scripts authored without agent outcomes/evaluator internals; log labor, allowed observations, unavailable adapters and deployment failures.                                                                                       |
| 7     | Stratified pilot and freeze            | Use disjoint development/pilot/confirmatory tasks. Shared models across visual and hybrid; fixed time/action budgets and retry policy; fresh isolated reset per cell. Estimate variance, task/template clustering and power before repetition freeze.                                                                     |
| 8     | Confirmatory collection                | Explicit gate approval, source/configuration digests, frozen schedule and analysis plan. Start small audited blocks, then scale only with complete evidence and no boundary violations.                                                                                                                                   |

## Scale, not a promise of statistical power

The next integration tranche is **5 tasks × 3 strategies × 1 repetition = 15 executions**, not 15 distinct tasks. Tasks 21, 22, 163–167 are development-exposed and must not silently enter primary confirmatory estimates.

After admission, propose a **12–24 task stratified protocol pilot**, covering the three benchmark families, task lengths, visual dependence, assertions and state-changing requirements. The existing controlled-core design has 5 configurations: two shared VLMs × two agent strategies plus one script baseline. A planning example of 120 eligible tasks × 5 repetitions × 5 configurations yields **3,000 executions**; this is neither a frozen task allocation nor a power result. Use the approved 5/7/10 repetition candidates and pilot simulation. Additional frameworks and Selenium belong to separately reported robustness strata, not extra votes in the primary denominator.

## Metrics and denominators

- WAV/VWA: native success with required protocol completion; benchmark-native aggregation, task/template/site strata and missing-evaluation coverage. Do not pool two benchmark scores into one weighted index.
- ATA: P/F correctness (FAIL positive), sensitivity, specificity, failure-step early/exact/late counts, strict step accuracy, and missing-verdict coverage. Report deployment and valid-verdict-conditional denominators separately.
- All: latency, reported tokens, unavailable monetary cost as null, repeated-run stability, authoring/repair cost, failure category and evidence completeness. A timeout is not rescued by later oracle reach.
- Environment/evaluator errors remain unresolved; provider/output/grounding failures remain deployment failures. Script adaptation failures remain in the deployment denominator. Post-hoc exclusions require a reason and sensitivity analysis, never disappearance.

## Concrete findings and revisions

1. ATA published CSV headers parse to **113 candidates**, whereas frozen v1's marker-based inventory counts 112. `postmill_failing.csv:1` begins with `í`, not `►`; its `TC-1-F` header is still valid. Preserve v1 and propose a provenance-linked amendment. Do not call 113 tasks admitted.
2. `postmill_passing.csv:118` has source step indices `[1,1,2,3,4,5]`; maintain source IDs and positional step IDs separately, adjudicate mapping rather than silently renumbering gold.
3. PinATA's `TestCase.__str__` includes the `P/F` suffix and is used in worker context. The PSS task export uses opaque IDs and excludes filenames/failure annotations. Expected assertions are legitimate public test specifications, unlike actual labels.
4. ATA's labels come from CSV P/F and Expected Failure annotations. PinATA's Actor/Assertor status is a prediction. Earlier "independence unverified" wording must not be interpreted as absence of gold labels; live fixture-label equivalence is still unverified.
5. The official VWA Classifieds archive is 25,366,023 bytes; MD5 `cf4fe746f22efa4e6102ac08fe76d4db`. Postmill archive is ~53.4 GB; stage Classifieds first. No unrelated container, cloud resource or remote GitHub reset is modified.

## Commands and monitoring

From `/Users/laurantwang/PSS-WebTest`:

```bash
node code/local-lab/benchmark-runner.mjs
node code/local-lab/validate-benchmark.mjs --export-public
node code/local-lab/prepare-vwa.mjs pull
node code/local-lab/prepare-vwa.mjs up
code/.venv-benchmark/bin/python code/local-lab/prepare-ata.py
node --test code/local-lab/*.test.mjs
```

Never rerun the first command automatically against a completed selection. Each new run needs a declared purpose, immutable version/selection and preserved previous evidence. `prepare-vwa` uses an isolated project and a 10-minute subprocess deadline. Credential files, raw results, agent inputs and evaluator labels stay gitignored. Publish only reviewed code and sanitized summaries; never paper materials or keys.

Continuation is bounded: first inspect a live process rather than spawning another. Automatically advance engineering preparation and tests; at most one new predeclared 15-execution integration block per day, with no response retries and no confirmatory collection. Stop API work on authentication/quota errors or repeated interface faults; preserve evidence and request help only when new authority, a paid resource, a design amendment, or independent human review is required.

## Primary sources

- [Pinned WebArena-Verified](https://github.com/ServiceNow/webarena-verified/tree/6473f72db5dcefc97b5725b59e734504edc28a21)
- [Official VWA deployment](https://github.com/web-arena-x/visualwebarena/blob/89f5af29305c3d1e9f97ce4421462060a70c9a03/environment_docker/README.md)
- [Published ATA artifact](https://zenodo.org/records/15198569)
- [PinATA evaluation semantics](https://github.com/Smartesting/pinata/blob/650b9edaa055915cb27d2498f379a66430cc3e02/evaluation.py)
