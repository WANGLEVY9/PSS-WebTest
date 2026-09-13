# 答辩陈述稿 B：实验数据的产生路径、来源、当前效果与结论

**适用场景**：答辩 / 阶段汇报中「你们的数据是怎么来的、规模多大、指标怎么算、现在能得出什么结论」这一环节
**建议时长**：12–15 分钟
**数据截止**：2026-09-09
**配套**：`defense-script-A-framework-and-pipeline-2026-09-09.md`（框架与流程）

---

## 0. 开场：先把结论边界说清楚（最重要的一段）

我要先给一个可能看起来"不好看"但必须说的数字：

> **当前可用于 RQ1–RQ4 确认性估计的记录数是 0 条，计划的 29,484 次启动执行一条都还没有采。**

这句话不是自贬，而是这项研究的设计要求。论文 §5 和 `paper/issta2027/RESULTS_DATA_STATUS.md` 都明确写着：**只有冻结台账（frozen ledger）里的记录才能进入确认性分析**。一条运行要合格，必须同时满足：

- 应用 / 工作流 / 条件 / 参考配置 / reset 与 SUT 摘要 / oracle / 随机化区块 / 协议版本 **全部冻结**；
- 通过 schema 校验；
- 通过准入门禁。

**一个 schema 合法的 pilot，只要早于冻结或没过准入门禁，就依然不合格。**

那么我们现在有的数据是什么？是**协议就绪度证据（protocol-readiness evidence）**：它们证明 reset、runner、oracle、溯源、三臂执行这条链路**能跑通并且能诚实地记录失败**，但不能用来估计策略效应。

---

## 1. 数据来源总账：461 → 36 → 33 → 0

这是一个四层漏斗，答辩时建议画出来：

```
本地已产生的运行记录（artifacts/phase2/*.jsonl，85 个文件）
│   合计 461 行（含历史账本、诊断、连通性检查、探索性 canary、重放审计）
│
├─ 历史/排除账本（21 类，已在 phase2-experiment-data 中逐条列出排除理由）
│     · 不同 run tag / 协议版本 / 任务 / provider-model / 不完整单元
│     · 例如 bookstack-three-arm-records.jsonl 73 条、bookstack-navigation-records.jsonl 47 条
│     · 规则：可审计、可诊断，但绝不并入当前聚合
│
├─ 当前 v0.2 合格证据：36 条记录 / 8 个隔离账本 / 31 条严格通过
│     · 1 个应用（BookStack）、2 个工作流、3 个条件、3 个参考配置、每格 n=3
│
├─ 论文内部表格保守列出的 pilot 切片：33 条 / 5 个切片
│     · 口径差异见 §1.1
│
└─ 确认性分析人口：0 条
```

### 1.1 为什么有两个数字（36 vs 33）

| 来源 | 记录数 | 口径 |
|---|---:|---|
| `research/phase2-experiment-data-2026-09-04.md` | **36** | 4 个区块 × 3 臂 × 3 次：create-page clean、create-page fault、open-book clean、open-book layout evolution |
| `paper/issta2027/PILOT_DATA_SUMMARY.md` 与论文 Table 3 | **33** | 5 个切片：上述前三个各 9 条 + layout evolution **1 次/臂**（3 条）+ search-to-Book2 **1 次/臂**（3 条） |

差异来自"layout evolution 记 3 次还是 1 次"以及"search 切片是否计入"。**两者都不是确认性数据**，论文表格采用的是更保守的切法。答辩时如果被问到，直接说明这是"两版内部台账的保守口径差异"，而不是数据矛盾。

### 1.2 已实现的 SUT 与工作流（数据来源的"分母"）

| SUT | 版本 | 状态 | 工作流 | Oracle 权威 | Oracle 状态 |
|---|---|---|---|---|---|
| BookStack | 25.02.1 | `admitted-pilot-only` | 8 个（create-page / open-book / edit-page / search-open-book2 / create-chapter / move-page / permission / delayed-save） | persisted-state / visible-ui | create-page 与 open-book 已 `independent-verified`，其余 `draft` |
| Indico | 3.3.6 | `pilot-only` | 8 个（create-event / create-event-desc / search-events / edit-date / privacy / edit-title / manage-session / registration-toggle） | relational | create-event 已验证，其余 `draft` |
| Juice Shop | 20.0.0 | `pilot-only` | 8 个（product-search / register / login / add-to-basket / checkout / change-password / cart-quantity / register-validation） | visible-ui + relational | product-search 已验证，其余 `draft` |

**校验输出**：`validate:benchmark-matrix` → 3 应用 / **24 工作流** / 5 个模型层 / 5 个传统基线，全部通过。
但要注意：24 个工作流里**只有少数几个有真实的三臂执行记录**，其余仍只是协议层记录（candidate）。

---

## 2. 指标是"怎么算出来的"：从代码到数字的完整追溯

这是我建议重点讲的部分——它回答"你的数字可信吗"。

### 2.1 严格通过（strict pass）的四重条件

代码位置：`code/src/paired-clean-fault-metrics.mjs` 的 `strictPass()`：

```js
record.status === 'completed'                                   // ① 协议正常结束
&& record.checkpoint_reached === true                           // ② 独立 oracle 判定状态达成
&& ['clean','fault'].includes(record.emitted_verdict)           // ③ 发出了可用判定
&& record.emitted_verdict === record.ground_truth_verdict       // ④ 判定 == 隐藏真值
```

对应论文的 $J = P \land S \land V$。

### 2.2 判定覆盖度与误报/漏报

同一文件 `summarizePairedCleanFault()`：

| 指标 | 计算方式 | 分母 |
|---|---|---|
| **Verdict coverage** | `emitted_verdict ∈ {clean, fault}` 的记录数 | **全部已启动运行** |
| **FPR** | clean 真值中被报成 `fault` 的条数 | clean 运行数 |
| **FNR** | fault 真值中**未**报成 `fault` 的条数（含 `unknown` 与 `not-emitted`） | fault 运行数 |
| **Sensitivity** | fault 中报对的比例 | fault 运行数 |
| **Specificity** | clean 中报对的比例 | clean 运行数 |
| **Balanced accuracy** | `(sensitivity + specificity) / 2` | — |

**关键设计**：`unknown` 和 `not-emitted` 在故障格上**算漏报**，但同时**单独报告覆盖度**。这样既不会因为"没给结论"就被当成通过，也不会把"没给结论"和"给错结论"混为一谈。

### 2.3 `oracle_only_success`：我们最想保留的一个区分

`code/src/outcome-admission.mjs`：

```js
taskStateReached  = oraclePassed === true
protocolCompleted = !failure && status==='completed' && normalize(emitted) === expected
oracleOnlySuccess = taskStateReached && !protocolCompleted      // ← 状态对了但没正确终止/没给判定
cellPassed        = taskStateReached && protocolCompleted
```

**为什么重要**：它把"页面恰好在正确状态"和"做完了一次合格的测试"分开。一个智能体可能已经把页面创建出来了，却因为超时没发出 verdict——我们记为 `oracle_only_success`，**不记为成功**。

### 2.4 运行记录里到底写了什么

`code/schemas/run-record.schema.json` 必填字段：

- **标识**：`schema_version`、`run_id`、`application_id`、`application_version`、`task_id`、`condition`、`arm`
- **结果**：`status`（`completed` / `test-failure` / `timeout` / `model-refusal` / `infrastructure-error` / `evaluator-error`）、`checkpoint_reached`、`emitted_verdict`、`ground_truth_verdict`
- **计时**：`timing = { wall_time_ms, actions, retries, tokens?, cost_usd? }` —— `tokens`/`cost_usd` 缺失为 `null`，**绝不补 0**
- **溯源**：`provenance = { runner_version, trace_hash, observation_contract, model_id, framework_id, framework_version, provider_id, prompt_digest, action_schema_version, code_framework, authoring_source, environment_digest, seed? }`
- **v0.2 附加必填**：`configuration_id`、`strategy_family`、`protocol_version`、`run_manifest_digest`、`sut_image_digest`、`reset_digest`、`randomization_block`（后三个必须是 64 位十六进制）
- **可选**：`failure_category`（15 个枚举值之一或 `null`）

**唯一性**：`application × task × condition × configuration × repetition` 五元组。

### 2.5 从原始记录到论文表格的脚本链

```
records:collect  → 汇总所有 JSONL，校验 schema
records:audit    → 查重 run_id + 检查"三臂是否齐全"（不齐全故意失败）
metrics:summarize   → 按 cell 输出 valid_completion / joint correctness / 平均 wall time /
                      平均动作数 / 平均重试 / failure 分布 / FPR / FNR
                      （clean-only 输入时 FPR/FNR 输出 null，这是刻意的）
metrics:paired-clean-fault → 输出配对 clean/fault 诊断表
report:phase2-evidence     → 生成含"历史排除清单"的完整数据表
pilot:variance / power:simulate → 方差与事前功效模拟（用于最终冻结重复数）
```

---

## 3. 逐切片数据复述：每一个数字是怎么跑出来的

### 3.1 BookStack 三臂配对 pilot（Qwen3-VL-Flash，阿里兼容端点）

**产生方式**：`PSS_MATCHED_REPETITIONS=3`，每个 arm 执行前独立 reset，`sha256(seed|rep|arm)` 排序决定臂序，reset digest 前缀 `6246d6dbf78b`，协议 `2.0-draft`。

| 任务 | 条件 | 臂 | n | 严格通过 | 平均墙钟(s) | 平均动作 | 平均重试 | 失败类别 |
|---|---|---|---:|---:|---:|---:|---:|---|
| create-page | clean-stable | playwright | 3 | **3/3** | 2.420 | 10.00 | 0.00 | none |
| create-page | clean-stable | hybrid | 3 | **3/3** | 13.859 | 8.00 | 0.67 | none |
| create-page | clean-stable | visual | 3 | **1/3** | 16.420 | 10.67 | 0.00 | `agent-step-budget`, `provider-format` |
| create-page | persistence-mismatch | playwright | 3 | **3/3** | 2.893 | 10.00 | 0.00 | none |
| create-page | persistence-mismatch | hybrid | 3 | **3/3** | 14.400 | 7.67 | 0.67 | none |
| create-page | persistence-mismatch | visual | 3 | **0/3** | 20.744 | 12.00 | 0.00 | `provider-format`, `grounding-loop` |
| open-book | clean-stable | playwright | 3 | **3/3** | 1.578 | 6.00 | 0.00 | none |
| open-book | clean-stable | hybrid | 3 | **3/3** | 4.254 | 2.00 | 0.00 | none |
| open-book | clean-stable | visual | 3 | **3/3** | 4.104 | 2.00 | 0.00 | none |
| open-book | layout-evolution v1 | playwright | 3 | **3/3** | 1.543 | 6.00 | 0.00 | none |
| open-book | layout-evolution v1 | hybrid | 3 | **3/3** | 4.202 | 2.00 | 0.00 | none |
| open-book | layout-evolution v1 | visual | 3 | **3/3** | 7.215 | 4.00 | 0.00 | none |

**合计：31/36 严格通过，分布在 8 个隔离账本中。**

### 3.2 配对 clean/fault 判定级诊断（这是目前信息量最大的一张表）

来源：`bookstack-create-page-paired-clean-fault-aliyun-qwen3-vl-flash-phase2-v1-metrics.json`，每个臂 6 次已启动运行（3 clean + 3 fault）。

| 臂 | 严格正确 | 判定覆盖度 | 误报率 | 漏报率 | Balanced accuracy |
|---|---:|---:|---:|---:|---:|
| Playwright | **6/6** | 6/6 | 0/3 | 0/3 | 1.00 |
| Hybrid | **6/6** | 6/6 | 0/3 | 0/3 | 1.00 |
| Visual | **1/6** | 1/6 | 0/3 | **3/3** | 0.17 |

**怎么读这张表**：

- 脚本臂和混合臂在这 6 次里既完成了协议、达成了状态、又给出了正确判定；
- 纯视觉臂**没有一次误报**（0/3），但**三次故障运行全部漏报**（3/3）——它每次都发不出可用的 fault 判定（`unknown` 或未发出）；
- 也就是说，纯视觉臂的问题不是"瞎报错"，而是**"到了状态但给不出结论"**。这正是我们要把 coverage 和 accuracy 分开报告的原因。

### 3.3 Indico search-events 单元（2026-09-08，n=1/臂）

**来源**：`research/phase2-indico-search-events-pilot-2026-09-08.md`；reset digest `1ceb32dc…`，18 个种子事件；任务为搜索字面量 `test`（只读）。

| 臂 | 配置 | 预算 | 单元结果 | 独立 oracle | 观察 |
|---|---|---|---|---|---|
| Playwright | `scripted-playwright-accessibility-human-v2` | 5 个脚本动作 + 显式渲染等待 | **pass** | pass | 1,429 ms |
| Visual | `visual-pss-native-aliyun-qwen3-vl-flash-v2` | 8 步 / 20 s 每请求 | fail | **pass** | 达到搜索状态但**未在预算内发出 `done(pass)`** |
| Hybrid | `hybrid-pss-native-aliyun-qwen3-vl-flash-v2` | 8 步 / 20 s 每请求 | fail | fail | 第二次点击重复了未变化的坐标，被判 `grounding-loop` |

**方法论价值**：这一格是"为什么必须同时报状态可达性和协议完成度"的最好例证——纯视觉臂**状态到了**但没正确终止。

**同批修正**：第一次脚本尝试因在显式 post-search 等待之前就评估，被记为 `evaluator-error` 并**保留在账本里、不改写、不计入配对结果**；runner 修正为等待可见标题与首个事件链接后 reset 重跑。

### 3.4 BookStack search-to-Book2（2026-09-08，n=1/臂）

**来源**：`bookstack-search-open-book2-clean-stable-manual-ledger-r2-*`；reset digest `6246d6dbf78bf965…`；任务改编自本地 vendored WebTestPilot 的 `search.yaml`（commit `b0659bd9…`），但**不是**复现其报告结果。

| 臂 | 严格结果 | 墙钟 (ms) | 动作数 | 重试 | 失败类别 | 说明 |
|---|---|---:|---:|---:|---|---|
| Playwright | pass | 1,902 | 7 | 0 | — | 完成且 oracle 通过 |
| Hybrid | pass | 7,841 | 4 | 0 | — | 完成、发出 `pass`、oracle 通过 |
| Visual | **fail** | 19,400 | 10 | 1 | `agent-step-budget` | **独立 oracle 判定已到达 Book2**，但超时未发出完成判定 → 记为 `oracle_only_success` |

指标 JSON 中 visual 的 `joint_end_to_end_correctness_rate = 0`、`verdict_correct_rate = null`（未发出判定）。

**同批基础设施修正**：reset wrapper 原先只等前 3 张表就报 `schema-ready`，导致 SQL 播种与迁移流竞争。现在门禁要求 **5 张关键表 + 至少 90 次迁移**（版本固定镜像的已完成迁移数）后才播种。这是 reset 工具的修正，**不改变真值或判定规则**。

### 3.5 重放审计 smoke（2026-09-09，create-page / qwen3.7-flash）

**来源**：`research/phase2-replay-audit-smoke-2026-09-09.json` + `artifacts/phase2/bookstack-replay-audit-live.jsonl`

| 臂 | 严格通过 | 帧数 | provider 事件 | 独立 oracle | 失败类别 |
|---|---|---:|---:|---|---|
| Playwright | **true** | 20 | 0 | passed | — |
| Visual | false | 7 | 3 | not reached | `provider-timeout` |
| Hybrid | false | 7 | 3 | not reached | `provider-timeout` |

**这一条证明的是"仪器"而不是"效果"**：逐帧截图摘要、逐帧状态里程碑都成功落盘，provider 超时也被如实保留（`provider_raw_content_persisted: false`，原始供应商内容不落盘）。

### 3.6 混合臂接地方式对比 smoke（2026-09-09，非配对）

**来源**：`research/framework-variant-smoke-2026-09-09.json`

| 变体 | 动作数 | 严格通过 | 失败类别 | 接地协议 |
|---|---:|---|---|---|
| native-hybrid-coordinate | 3 | false | `provider-timeout` | 归一化坐标点击 |
| native-hybrid-semantic-candidate | 6 | **true** | — | 由 harness 解析 candidate `target_id` |

**边界声明（务必照念）**：这是一次**探索性、非配对**的实现对比。它证明语义接地在技术上可行，**不是因果估计，也不是"hybrid 更优"的证据**。

### 3.7 外部框架 smoke（2026-09-09）

| 框架 | 证据 | 边界 |
|---|---|---|
| Browser Use 0.13.10 | BookStack 已认证导航到达 `/books/book`；5 步 / 31,898 ms；v0.2 记录 + 4 帧重放 + 4 份受限 provider 摘要 | 探索性 smoke，无配对准入 |
| Stagehand 3.0.8 | 自定义 LLMClient 路由 Qwen；`act` 接收截图 + Stagehand a11y 快照；记录与重放通过注册表校验 | 内置 `agent.execute` 被 Qwen 拒绝；可见定位器回退**在重放中显式标记**，不算纯模型成功 |
| AgentLab/BrowserGym | `pss-bookstack-open-book` 的 setup/观察/oracle 适配器通过 | 模型驱动的 policy 尚未准入 |

### 3.8 探索性 500 区块活动的 canary（2026-09-08）

设计目标 500 个配对区块 / 1,500 次执行，状态 `preflight-required`。**实际只跑了 canary**：

| 批次 | 观测区块 | 完整三臂区块 | 三臂全通过区块 | 各区块严格通过格数 |
|---|---:|---:|---:|---|
| qwen3-vl-flash canary | 5 | 5 | **1** | 0001 create-page 2/3（provider 失败边界）、0002 open-book **3/3**、0003 search-open-book2 2/3（provider 失败边界）、0004 indico-create-event 1/3、0005 juice-shop-search 1/3（provider 失败边界） |
| qwen37-admission-v1 | 1 | 0（只观测到 playwright + visual） | — | 1/2 |
| qwen37-admission-v3 | 5 | 5 | **1** | — |

**合计 canary 规模**：约 5×3 + 2 + 5×3 = 32 次执行量级，**全部标记为 `confirmatory: false`**。

---

## 4. 数据规模量：一张可以直接念的表

| 维度 | 数量 |
|---|---:|
| 本地 JSONL 运行记录总行数 | **461**（85 个文件，含历史/排除/诊断/canary） |
| 当前 v0.2 合格证据记录 | **36**（8 个隔离账本，31 条严格通过） |
| 论文内部保守列出的 pilot 切片记录 | **33**（5 个切片） |
| 探索性 500 活动实际 canary 执行 | 约 **32**（15 + 2 + 15） |
| 已确认 SUT | **3**（BookStack / Indico / Juice Shop） |
| 已编目工作流（benchmark matrix） | **24**（3 应用 × 8） |
| 有真实执行记录的工作流 | **6**：bookstack-create-page、bookstack-open-book、bookstack-search-open-book2、indico-create-event、indico-search-events、juice-shop-product-search（后三者仅有 n=1 的探索性三臂区块） |
| 已登记配置 | **14**（visual=5, hybrid=7, scripted=2；含 5 个 legacy-pilot、7 个 implemented、2 个 candidate） |
| 已实现的独立 oracle | **4**（bookstack-visible / bookstack-persistence / indico-visible-search / juice-shop-ui-search） |
| 契约测试 | **34 文件 / 102 条，全通过** |
| **确认性分析人口** | **0 / 29,484** |

---

## 5. 当前能说什么、不能说什么（结论部分）

### 5.1 可以说的（全部是**协议就绪度**结论）

1. **链路可跑通**：reset → 三臂执行 → 独立 oracle → 不可变记账 → 审计 → 汇总，这条链在 BookStack（4 个条件格）、Indico（1 格）、Juice Shop（1 格）上都跑通了。
2. **失败能被诚实记录**：provider 超时、grounding-loop、step budget 耗尽、provider 返回格式错误、reset 失败、evaluator 错误各有独立状态码并留在分母里。
3. **隔离是强制的**：观察契约断言 + 102 条契约测试（含不发起真实请求的适配器一致性测试）证明纯视觉臂拿不到 DOM/结构/oracle/变异标签。
4. **语义保持的演化是可构造且可验证的**：`bookstack-layout-v1` 在导航任务上三臂均 3/3，说明这个 CSS-only 变体在该 fixture 上保持了任务与 oracle。
5. **观察到了有意义的失败机制差异**：纯视觉臂的主要失效是**"到达状态但发不出终止判定"**（`oracle_only_success`、step-budget 耗尽），而混合臂在同一批任务上表现稳定；在 Indico 一格上混合臂出现 `grounding-loop`。
6. **运维代价的定性排序已显现**：脚本臂 1.5–2.9 s，混合臂 4.2–14.4 s，纯视觉臂 4.1–20.7 s。**但这只是量级观察，不是效应估计。**

### 5.2 明确**不能**说的（答辩时建议主动列出）

1. ❌ 不能说"Playwright 优于 CUA"或任何策略族排序。
2. ❌ 不能说"hybrid 比 visual 好"——语义接地 smoke 是**非配对**的，只证明可行性。
3. ❌ 不能把 BookStack 的结果外推到 Indico / Juice Shop / 其他应用。
4. ❌ 不能把 Qwen3-VL-Flash 的结果外推到整个"CUA 族"——单模型/单供应商层。
5. ❌ 不能合并不同 provider / 模型 / 框架 / run tag / 协议版本 / 任务的层（`non_substitution_rules` 明确禁止）。
6. ❌ 不能用更多 `bookstack-open-book` 的重复来替代缺失的 SUT 或工作流。
7. ❌ 不能把适配器一致性检查、连通性检查、诊断运行、`oracle_only_success` 计入确认性运行。
8. ❌ 不能把缺失的 token / 成本补成 0。
9. ❌ 不能把 n=3 的格子当成总体成功率；论文明确给出了 Wilson 下界只有 **0.439** 的例子（3/3 的 clean 导航任务）。
10. ❌ 不能把"改了界面"自动算作演化——没有通过不变式套件的变体不能进演化层。

### 5.3 一句话总结结论

> **当前唯一被证据支持的决策是程序性的：先完成准入、冻结台账，再解释策略对比。**
> （论文 §6.1 原文立场：The only immediate decision supported by the present evidence is procedural.）

---

## 6. 从现在到确认性结果：还缺什么

`RESULTS_DATA_STATUS.md` 列出了在报出任何数值结果之前必须补齐的五件制品：

1. 通过 `code/scripts/collect-run-records.mjs` 采集的 **append-only、schema 合法的 JSONL 运行记录**；
2. 能校验每一条记录的**配置注册表 + 冻结的工作流/条件 manifest**；
3. `code/scripts/audit-run-ledger.mjs` 的审计输出（含重复运行与缺臂检查）；
4. `code/scripts/summarize-run-records.mjs` 生成的**派生单元汇总**（缺失的 token/成本保持缺失）；
5. **流向清单（flow inventory）、协议偏差台账、oracle/准入证据、以及每张论文表/图对应的分析脚本与输出哈希**。

再往前，`PREREGISTRATION_DRAFT.md` 第 L 节还有 9 项开放决策（最终应用与版本、CUA/hybrid 实现与模型复制策略、任务与变异 manifest、实际重要效应量与模拟功效、API/人力预算上限、修复操作者与删失上限、评分者信度阈值、缺失/基础设施错误规则、注册托管与许可证）。

---

## 7. 可能被追问的问题（B 篇）

**Q：你们跑了 461 条记录，为什么还说 0 条结果？**
因为 461 条里绝大多数是历史账本、诊断、连通性检查和探索性 canary，它们分属不同的协议版本、run tag、provider/model 与不完整单元，规则上禁止合并。符合当前 v0.2 协议的只有 36 条，而这 36 条又早于"冻结"，所以进入确认性人口的仍是 0 条。**能合并的前提是同质性，不是数量。**

**Q：n=3 能不能报百分比？**
我们在内部表里报了，但每一处都同时给了分母和"这不是总体成功率"的声明，并且给出了 Wilson 下界 0.439 的例子。论文正文里这些数字只出现在**明确标注为非确认性**的 pilot 表中。

**Q：为什么纯视觉臂在 open-book 上 3/3，在 create-page 上 1/3 和 0/3？**
这个对比本身说明了**任务结构决定失败模式**，而不是"视觉行不行"。open-book 是 2 步导航；create-page 涉及富文本编辑器 iframe、标题/正文分字段、异步保存，纯视觉臂出现了 `provider-format`（返回格式不合 schema）、`grounding-loop`（重复无效坐标）和 `agent-step-budget`（步数耗尽）。这也正是我们要做**失败分类学**而不是只看成功率的原因。

**Q：FNR = 3/3 是不是说明纯视觉臂完全不能测故障？**
不能这么下结论。它说明的是：**在这一套 prompt、这个模型、这个持久化不匹配故障、n=3 的条件下**，纯视觉臂每次都没能发出可用的 fault 判定。可能的原因包括 prompt 里对 fault 的描述不够、终止协议设计、以及模型能力。这也正是为什么 RQ5 的失败机制分析是必要的，而且为什么我们**不允许**把这个数字改写成主终点。

**Q：成本数据为什么是空的？**
因为供应商没有暴露可靠的 token/账单字段。我们的规则是：**缺失就是缺失，绝不补 0，也绝不推算。** 论文明说"成本结论仅限于可观测字段与声明的采集区间"。

**Q：如果答辩委员会要求你现在给一个初步结论怎么办？**
给**条件化的、带边界的**结论：在当前 BookStack 的两个工作流、Qwen3-VL-Flash 这一供应商/模型层、每格 n=3 的 pilot 里，可访问性定位器脚本和混合臂完成了协议并给出了与隐藏真值一致的判定；纯视觉臂在导航任务上可以完成，在创建-页面任务上主要因为**无法在预算内发出终止判定**而失败。这是一个**机制观察**，不是一个**效应估计**，其外部有效性受限于单应用、单工作流族、单模型层与未冻结协议。

---

*配套文档：`defense-script-A-framework-and-pipeline-2026-09-09.md`*
