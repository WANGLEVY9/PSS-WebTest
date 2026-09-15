# AI evidence audit — 2026-09-15

> Diagnostic artifact only. This report is not a human review, does not satisfy the two-reviewer requirement, and does not authorize confirmatory collection.

## Scope and integrity

- Frozen pilot candidates: **192**
- Model identities audited: **deepseek-r1, deepseek-r2, qwen-r1, qwen-r2**
- Latest valid records per identity: **192/192**
- Formal reviewer store touched: **no**
- Canonical screening ledger touched: **no**
- Confirmatory authorization: **false**
- Machine-readable task audit: `code/artifacts/benchmark-snapshots/llm-screening-simulations/2026-09-14-llm-screening-full/task-audit.json`

## What can be established from the current packet

- IC1 is provisionally supportable from the frozen candidate manifest and source identity fields.
- IC2–IC7 are not uniformly provable from the model prompt alone because evaluator, environment, reset, tolerance, credential-policy, and three-paradigm feasibility evidence was not included.
- ATA task titles can contain PASS/FAIL markers and ATA instructions can contain test-account credentials. These must not be used as shortcuts for eligibility decisions.

## Cross-model disagreement (candidate-level)

- IC1: **27 / 192** tasks have at least two distinct model decisions.
- IC2: **182 / 192** tasks have at least two distinct model decisions.
- IC3: **132 / 192** tasks have at least two distinct model decisions.
- IC4: **28 / 192** tasks have at least two distinct model decisions.
- IC5: **14 / 192** tasks have at least two distinct model decisions.
- IC6: **18 / 192** tasks have at least two distinct model decisions.
- IC7: **164 / 192** tasks have at least two distinct model decisions.

## Rationale/decision contradiction flags

The detector only flags explicit linguistic contradictions; a clean record is not proof of correctness.

| Model | IC1 | IC2 | IC3 | IC4 | IC5 | IC6 | IC7 |
|---|---:|---:|---:|---:|---:|---:|---:|
| deepseek-r1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 |
| deepseek-r2 | 0 | 6 | 0 | 0 | 0 | 0 | 1 |
| qwen-r1 | 0 | 1 | 0 | 0 | 0 | 0 | 20 |
| qwen-r2 | 0 | 2 | 0 | 0 | 5 | 4 | 53 |

Representative contradiction patterns requiring manual review:

- **deepseek-r1**
  - IC2 (yes_vs_negative_basis) — 39 — Instruction text is supplied directly; evaluator is implied by the benchmark dataset entry but not shown.
- **deepseek-r2**
  - IC7 (no_vs_positive_basis) — TC-3-P :: Profile — The instruction includes explicit login credentials, indicating required access information is supplied rather than absent, but the criterion asks for no secret/external/privileged information; credentials are present in the task material.
  - IC2 (yes_vs_negative_basis) — 207 — Instruction text and start URLs are supplied directly from the source config without semantic edits; evaluator is implied by benchmark config but not shown.
  - IC2 (yes_vs_negative_basis) — 420 — Instruction is present verbatim and no evaluator text is supplied, but the task material contains a complete natural-language instruction without semantic edits.
  - IC2 (yes_vs_negative_basis) — 452 — Instruction is provided verbatim and no semantic edits are indicated; evaluator is not shown but task material is self-contained.
  - IC2 (yes_vs_negative_basis) — 540 — Instruction is given verbatim and no semantic edits are indicated; evaluator is not shown but the task material is self-contained.
- **qwen-r1**
  - IC7 (no_vs_positive_basis) — TC-5-F :: Login with the dropdown menu,,Fail — The instruction explicitly includes privileged credentials ('[redacted-email]' and '[redacted-credential] required to complete the task, violating the no secret information criterion.
  - IC7 (no_vs_positive_basis) — TC-5-P :: Connection — The instruction requires entering specific credentials ('[redacted-email]' and '[redacted-credential] to access a URL. This constitutes privileged information (credentials) required to complete the task, violating the 'no secret/privileged information' criterion unless these are publicly known test accounts, which is not proven here.
  - IC7 (no_vs_positive_basis) — TC-6-P :: Blocking list — The instruction explicitly requires logging in with specific credentials ('[redacted-credential] / [redacted-credential] This constitutes privileged or secret information not publicly available, violating the requirement for no secret/privileged info.
  - IC7 (no_vs_positive_basis) — TC-5-P :: Settings — The instruction explicitly requires credentials ('[redacted-credential] / [redacted-credential] These appear to be privileged secrets required to access the target site, violating the requirement for no secret/privileged information.
  - IC2 (yes_vs_negative_basis) — 86 — The task material provides the instruction text. The evaluator is implied by the benchmark structure (standard for VisualWebArena tasks), though not explicitly detailed in the snippet, it is part of the standard release package.
- **qwen-r2**
  - IC7 (no_vs_positive_basis) — TC-5-F :: Login with the dropdown menu,,Fail — The instruction explicitly contains plaintext credentials ('[redacted-email]' and '[redacted-credential] While these are part of the task definition, their presence in the prompt suggests no secret external information is *required* beyond what is provided, but typically benchmarks avoid hardcoding specific user credentials unless they are public test accounts. However, strictly speaking, the info is present in the source, so it is not 'secret' or 'external' in the sense of being hidden from the model. Wait, IC7 says 'No secret, external, or privileged information required'. The credentials are provided in the instruction. Therefore, the model does not need to find them externally. Thus, this criterion is met because all necessary info is in the prompt. Decision: Yes.
  - IC7 (no_vs_positive_basis) — TC-5-P :: Connection — The instruction explicitly provides the email ('[redacted-email]') and [redacted-credential] ('[redacted-credential] These are credentials required to perform the task, but they are fully disclosed in the public task material, meaning no secret or privileged information is hidden from the agent.
  - IC7 (no_vs_positive_basis) — TC-27-P :: Change Password — The instruction explicitly provides the email ('[redacted-email]') and [redacted-credential] ('[redacted-credential] required to complete the task. This constitutes privileged information (credentials) being part of the public task material, violating the requirement for no secret/privileged info if interpreted as requiring external secrets, OR more likely, it proves that NO secret info is *required* because it's given. Wait, IC7 says 'No secret, external, or privileged information REQUIRED'. Since the credentials are provided in the prompt, the agent does NOT need to find them externally. Therefore, the criterion is met. Re-evaluating: The criterion is satisfied because the necessary info is present in the task description.
  - IC7 (no_vs_positive_basis) — TC-2-F :: Automatic update of the wish list listings on quantity attributes,,Fail — The instruction requires specific private credentials ('[redacted-credential] and a specific user account ('emma.lopez'). While provided in the prompt, this represents privileged information required to execute the task, violating the spirit of no secret/privileged info if such data were not publicly disclosed in the source.
  - IC2 (no_vs_positive_basis) — TC-6-P :: Blocking list — The instruction contains hardcoded credentials ('[redacted-credential] / [redacted-credential] and specific UI navigation steps. This constitutes semantic edits to the environment state (account creation/login) rather than a generic evaluator interface, violating the requirement for an available evaluator without such edits.

## Highest-priority task conflicts

These are diagnostic conflict candidates, not exclusions. They should be reviewed first once the evidence pack is available.

| Priority | Benchmark/task | Risk signal | Criterion(s) |
|---:|---|---|---|
| 1 | autonomous-tester-agent-benchmark / TC-6-P :: Blocking list | 3 rationale contradiction(s); 6 model disagreement(s) | IC1, IC2, IC4, IC5, IC6, IC7 |
| 2 | autonomous-tester-agent-benchmark / TC-5-F :: Login with the dropdown menu,,Fail | 2 rationale contradiction(s); 6 model disagreement(s) | IC1, IC2, IC3, IC4, IC6, IC7 |
| 3 | autonomous-tester-agent-benchmark / TC-5-P :: Settings | 2 rationale contradiction(s); 5 model disagreement(s) | IC1, IC2, IC3, IC6, IC7 |
| 4 | webarena-verified / 95 | 2 rationale contradiction(s); 5 model disagreement(s) | IC2, IC3, IC4, IC6, IC7 |
| 5 | visualwebarena / 86 | 2 rationale contradiction(s); 4 model disagreement(s) | IC2, IC3, IC6, IC7 |
| 6 | visualwebarena / 19 | 2 rationale contradiction(s); 4 model disagreement(s) | IC2, IC5, IC6, IC7 |
| 7 | visualwebarena / 213 | 2 rationale contradiction(s); 4 model disagreement(s) | IC2, IC3, IC4, IC7 |
| 8 | webarena-verified / 221 | 2 rationale contradiction(s); 4 model disagreement(s) | IC2, IC3, IC4, IC7 |
| 9 | webarena-verified / 278 | 2 rationale contradiction(s); 4 model disagreement(s) | IC2, IC3, IC4, IC7 |
| 10 | autonomous-tester-agent-benchmark / TC-5-P :: Connection | 2 rationale contradiction(s); 3 model disagreement(s) | IC1, IC2, IC7 |
| 11 | visualwebarena / 36 | 2 rationale contradiction(s); 3 model disagreement(s) | IC2, IC3, IC7 |
| 12 | visualwebarena / 300 | 2 rationale contradiction(s); 3 model disagreement(s) | IC2, IC3, IC7 |
| 13 | visualwebarena / 114 | 2 rationale contradiction(s); 3 model disagreement(s) | IC2, IC5, IC7 |
| 14 | visualwebarena / 219 | 2 rationale contradiction(s); 3 model disagreement(s) | IC2, IC3, IC7 |
| 15 | webarena-verified / 83 | 2 rationale contradiction(s); 3 model disagreement(s) | IC2, IC3, IC7 |
| 16 | visualwebarena / 111 | 1 rationale contradiction(s); 5 model disagreement(s) | IC1, IC2, IC3, IC4, IC7 |
| 17 | webarena-verified / 330 | 1 rationale contradiction(s); 5 model disagreement(s) | IC2, IC3, IC4, IC6, IC7 |
| 18 | webarena-verified / 545 | 1 rationale contradiction(s); 5 model disagreement(s) | IC1, IC2, IC3, IC6, IC7 |
| 19 | autonomous-tester-agent-benchmark / TC-27-P :: Change Password | 1 rationale contradiction(s); 4 model disagreement(s) | IC1, IC2, IC3, IC7 |
| 20 | autonomous-tester-agent-benchmark / TC-2-F :: Automatic update of the wish list listings on quantity attributes,,Fail | 1 rationale contradiction(s); 4 model disagreement(s) | IC1, IC2, IC6, IC7 |

## Evidence checklist and citation suggestions

| Criterion | Required evidence | Suggested local citation anchors |
|---|---|---|
| IC1 — 官方任务身份 | candidate manifest + 对应 source_file；核对 benchmark、pinned source commit、官方 task ID、instruction digest。 | code/artifacts/benchmark-snapshots/outcome-blind-task-candidates-v1.0.json；每个候选的 source_file |
| IC2 — 原始 instruction 与 evaluator | 引用官方 release 的任务文件和 evaluator 可用性/版本说明；不得把 expected_result 当作 evaluator。 | code/artifacts/benchmark-snapshots/webarena-verified/README.md#L12-L31,L186-L225；visualwebarena/evaluation_harness/evaluators.py；ata-zenodo/ISSTA_ARTEFACT/README.md#L73-L86,L126-L154 |
| IC3 — 浏览器环境可执行性 | 引用官方环境部署、站点范围、浏览器版本、登录方式和外部依赖说明；URL 本身不构成证明。 | webarena-verified/README.md#L54-L182；visualwebarena/environment_docker/README.md#L1-L80；ATA README 中各站点 URL 与执行命令 |
| IC4 — 三范式共同语义目标 | 基于原始 intent 和三臂 information-boundary contract 建立逐任务 action-feasibility mapping；不得使用运行结果。 | research/FINAL-STUDY-DESIGN-v1.0.md#L110-L145；对应任务 source_file 与 instruction |
| IC5 — reset/reinitialization | 引用官方 reset 命令、reset token/credentials policy 和重复 reset 验证记录；记录版本与初始状态 digest。 | webarena-verified/README.md#L166-L182；visualwebarena/environment_docker/README.md#L74-L80；ATA reset 机制需补充官方证据 |
| IC6 — 确定性 evaluator 或 tolerance | 引用 evaluator 文档/版本和预注册 tolerance；单纯的 expected UI text、LLM judge 或截图描述不足。 | webarena-verified/README.md#L28-L30；webarena-verified/docs/evaluation/*；visualwebarena/evaluation_harness/evaluators.py；ATA evaluation.py/pinata README |
| IC7 — 秘密、外部或特权信息 | 核对官方 credential policy、CAPTCHA、外部站点依赖和账号是否为公开 fixture；require_login 不自动等于 no。 | visualwebarena/README.md#L58-L85；ATA SeeAct README#L233-L235；各 benchmark environment documentation |

## Local benchmark-artifact feasibility audit

- **WebArena-Verified:** the pinned source contains 812 tasks; its README documents an audited release, deterministic type-aware scoring, and environment-control health/reset interfaces. This supports benchmark-level evidence for IC2/IC5/IC6, but the local environment is still `not-installed`, so IC3 and the operational reset gate remain pending.
- **VisualWebArena:** the pinned source contains 910 tasks and reset scripts. The local evaluator inventory contains 409 `program_html`, 280 `string_match`, 224 `url_match`, and 42 `page_image_query` evaluator entries; 49 targets use `fuzzy_match`. The evaluator source calls `llm_fuzzy_match`, `llm_ua_match`, and a `captioning_fn` for image queries. IC6 therefore cannot be marked yes for the whole benchmark without a task-level deterministic-subset split or a pre-registered evaluator tolerance/repeatability audit.
- **ATA/PinATA:** the pinned artifact contains 112 tasks and an `evaluation.py` that reports PASS/FAIL, failing-step and confusion metrics. Its reset function dispatches a GitHub Actions workflow using `GITHUB_TOKEN`, and the Pinata assertor uses an LLM over screenshots. The official README also warns that direct login is unsupported. Remote reset, evaluator independence, login-task treatment and credential provisioning remain unresolved; IC5/IC6/IC7 need explicit task-level adjudication before admission.
- These findings affect feasibility and evidence requirements, not post-hoc task exclusion. Any task-list change must occur before HF1 or through a versioned amendment plus affected-arm rerun.

## Human-verification queue

For every high-risk task, a human reviewer should record the following before deciding yes/no:

1. the exact source-file location and digest used;
2. the official evaluator/documentation reference, without exposing evaluator internals to the testing arms;
3. browser environment and start-state evidence;
4. reset/reinitialization command and repeatability evidence;
5. whether the same semantic intent has a legal path under all three information-boundary contracts;
6. deterministic evaluator or pre-registered tolerance evidence;
7. credential/CAPTCHA/external-dependency classification and the applicable EX1–EX8 code if excluded.

## Decision

This audit supports continuing the study design, but not opening confirmatory collection. The next valid action is to assemble the criterion-specific evidence pack and have Reviewer 1 and Reviewer 2 independently complete the 192-task pilot in separate reviewer stores. Model labels remain diagnostic and must not be used as a majority vote.
