# 答辩陈述稿 A：整体工作框架与实验流程

**适用场景**：答辩 / 阶段汇报中「介绍你们做了什么、系统怎么搭的、实验怎么跑的」这一环节
**建议时长**：12–15 分钟（含图表讲解）
**数据截止**：2026-09-09
**对应论文**：`paper/issta2027/main.tex`（ISSTA 2027 投稿版本，单文件手稿，1583 行）

---

## 0. 开场 30 秒：一句话定位

我们这项工作叫 **PSS-WebTest**，论文题目是
*Pixels, Page Structure, or Scripts? An Empirical Study of Web UI Testing Strategies under Faults and Interface Evolution*。

一句话概括：**我们把"纯截图智能体"、"截图+受限页面结构的混合智能体"和"可访问性定位器的 Playwright 脚本"三种可部署的 Web UI 测试策略，放在同一批任务、同一套初始状态、同一个独立判定器、同一份预算下做配对对比，并且把"界面演化"和"真实功能缺陷"这两件事严格分开。**

我要特别先声明一个立场，它决定了后面所有设计：**我们不做排行榜。** 我们不是要证明"CUA 比传统测试好"或者反过来，而是要给出**条件化的适用边界**：在什么任务、什么界面条件、什么判定权威、什么成本预算下，哪一种策略更可靠。

---

## 1. 研究问题：五个 RQ 与它们的主次关系

论文冻结了四个**确认性（confirmatory）**问题和一个**探索性**问题：

| 编号 | 问题 | 主要估计量 | 性质 |
|---|---|---|---|
| **RQ1** | 在 clean 与 functional-fault 条件下，三个策略族在**严格端到端测试正确性**上差多少？ | 配对族间对比 + 族×条件交互；风险差、比值比、95% CI | 确认性 |
| **RQ2** | 三个策略族在**判定覆盖度**与全样本误报/漏报行为上差多少？ | verdict coverage、FPR、FNR、unknown 率，分母为**全部已启动运行** | 确认性 |
| **RQ3** | **语义保持的界面演化**之后，严格正确性保留多少？不保留时需要多少修复工作量？ | 配对 clean vs evolution 的保留率；修复需在 3 次全新 reset 下通过不变 oracle | 确认性 |
| **RQ4** | 结果如何随配置、应用、领域、本地/跨 Web 范围、时间窗变化？运维代价是什么？ | 分层异质性 + 延迟/重试/动作数/可观测成本 | 确认性 |
| **RQ5** | 哪些 trace 可回溯的失败与修复机制划定了策略选择的边界？ | 失败分类学、决策边界 | **探索性**，不得事后改写主终点 |

**答辩要点**：RQ5 明确标注为探索性，且论文写明"不得在看到数据后用它去重新定义确认性终点"。这是防 outcome shopping 的关键承诺，建议主动讲出来。

---

## 2. 论文当前的写作状态（务必讲清楚，避免被追问口径）

论文目前是一份**"设计已冻结、结果待采集"**的手稿：

| 部分 | 状态 |
|---|---|
| Abstract / Introduction / Background（5 个小节） | **已完成**，含完整动机链与文献定位 |
| Experiment（实验设计，7 个小节） | **已完成并冻结**：单位、契约、准入、面板规模、终点、分析计划 |
| Benchmark Construction（5 个小节） | **已完成**：候选→准入流水线、跨 Web 面板、reset/溯源、oracle 设计、变异与演化、制品边界 |
| Results（5 个小节） | **只有"证据状态"和"报告契约"**：明确写明当前**没有任何确认性记录**（0 / 29,484），只保留可行性/准入 pilot |
| Discussion（4 个小节） | **已完成框架**：条件化部署指南表、失败机制分类学、边界声明；结论行必须引用冻结台账 |
| Threats to Validity（6 个小节） | **已完成**：构造/内部/结论/外部/可复现/负责任发布 |
| Related Work + 定位表 | **已完成**，与 7 项相邻工作做了六维定位对比 |
| Conclusion / Data Availability | **已完成**，但明确"最终结论只报冻结台账能支撑的条件化发现" |

**一句话**：方法论部分已经可以答辩，实验数据部分还处在**准入（admission）阶段**，尚未进入确认性采集。

---

## 3. 整体技术框架：五层结构

整个系统可以拆成五层，每层都有独立的可审计产物：

```
┌─────────────────────────────────────────────────────────────────┐
│ 第 5 层  账本 / 审计 / 汇总层                                      │
│  append-only JSONL run records → records:audit → metrics:summarize│
│  → paired-clean-fault-metrics → phase2-evidence-report → dashboard│
├─────────────────────────────────────────────────────────────────┤
│ 第 4 层  独立 Oracle 层（与 runner 物理隔离，结果永不回传）           │
│  bookstack-visible / bookstack-persistence / indico-visible-search│
│  / juice-shop-ui-search                                           │
├─────────────────────────────────────────────────────────────────┤
│ 第 3 层  条件与变异层（clean / fault / evolution，各自有正 controls） │
│  mutations/bookstack-layout.mjs、indico.mjs、juice-shop.mjs        │
│  faults: bookstack-fault.mjs、indico-fault.mjs                     │
├─────────────────────────────────────────────────────────────────┤
│ 第 2 层  Runner 与三臂执行层                                        │
│  visual（screenshot-only） / hybrid（+allow-listed structure）      │
│  / playwright（accessibility-first 冻结套件）                       │
│  observation-contracts.mjs 做强制隔离 + 递归防泄漏                  │
├─────────────────────────────────────────────────────────────────┤
│ 第 1 层  SUT 与 Fixture 层（自托管、版本固定、可确定性 reset）        │
│  BookStack 25.02.1 / Indico 3.3.6 / OWASP Juice Shop 20.0.0       │
│  lifecycle scripts: start / ready / reset / stop + reset digest    │
└─────────────────────────────────────────────────────────────────┘
```

**关键设计原则**：第 2 层的执行方**永远看不到**第 4 层的答案，也看不到第 3 层的变异标签。这不是文档里的承诺，而是代码里用 `assertObservationContract()` 强制执行的（见第 4 节）。

---

## 4. 三个策略族：不是"三种模态"，而是"三个可部署包裹（bundle）"

这是我在答辩中最想强调的方法论判断。

我们比较的不是"像素 vs DOM vs 脚本"这三种**感官输入**，而是三个**部署包裹**。一个包裹包含：观察接口 + 动作循环 + 执行框架 + 编写产物 +（对智能体而言）模型与供应商。

| 策略族 | 观察契约 `observation_contract` | 允许拿到 | **明确禁止**拿到 |
|---|---|---|---|
| **Visual**（纯视觉 CUA） | `screenshot-only` | 截图、自然语言意图、允许的测试凭据、声明的浏览器动作集 | `dom`、`pageStructure`、`accessibilityTree`、`selectors`、`network`、`applicationState`、`goldOracle`、`mutationLabel` |
| **Hybrid**（视觉+结构） | `screenshot-plus-structure` | 截图 + **版本化、allow-list 的**结构表示（role / accessible name / state / 稳定 harness 引用） | `goldOracle`、`mutationLabel`、`applicationState` |
| **Scripted**（脚本化基线） | `scripted-locator` | 冻结的 accessibility-first Playwright 套件：role / label / text / 有正当理由的 test-id + 显式断言 | `runtimeModelPrompt`、`goldOracle`、`applicationState`、`mutationLabel` |

### 4.1 隔离是怎么"强制"而不是"声明"的

`code/src/arms/observation-contracts.mjs` 里有一个冻结的契约表和一个 `assertObservationContract(arm, observation)` 函数。它做三件事：

1. 检查 `required` 字段是否缺失；
2. 检查 `forbidden` 字段是否出现；
3. **递归深度扫描整个 observation 对象**（用 `WeakSet` 防环），把藏在嵌套结构里的 forbidden 键也抓出来。

报错时只打印**字段名**，不打印值，避免日志本身泄漏隐藏状态。这条路径有专门的契约测试 `tests/contracts/hybrid-agent-contract.test.mjs` 和 `adapter-conformance.test.mjs` 覆盖，且**不发起任何真实供应商请求**（用确定性本地 double）。

> **答辩原话建议**："我们的隔离不是靠自觉，是靠 fail-closed 的断言加 102 条契约测试。光这一条就把纯视觉臂'偷偷看 DOM'这条路堵死了。"

### 4.2 脚本臂不是"稻草人"

我们**故意不把传统基线写成脆弱的 CSS/XPath 脚本**。Playwright 臂使用可访问性优先的定位器和显式断言，是"有代表性的工程基线"。Selenium、legacy CSS/XPath、state-model testing、脚本生成式测试都被登记为**探索性基线**，在 `benchmark-matrix.v0.1.json` 中标为 `planned-exploratory`，不进主对比。

---

## 5. 实验单位、配置注册表与面板设计

### 5.1 分析单位

**单位 = 一次已启动的执行（one started execution）**，由五个字段唯一标识：

```
application(版本固定) × workflow × condition × configuration(冻结) × repetition index
```

`repetition index` 区分的是**独立 reset 的重复尝试**，不是额外处理。

### 5.2 配置注册表：报告的**最小可报告单元是 configuration，不是 arm 标签**

`code/config/configuration-registry.v0.2.json` 目前登记 **14 个配置**（校验输出：`14 configurations (visual=5, hybrid=7, scripted=2), protocol 2.0-draft`）。每条绑定：

- 策略族 `family`（visual / hybrid / scripted）
- 框架与版本（如 `pss-native@0.2`、`playwright@1.55`、`stagehand-grounded@3.0.8`、`browser-use-grounded@0.13.10`）
- 供应商与模型（如 `aliyun-compatible/qwen3-vl-flash`、`qwen3.7-flash`、`volcengine-ark/doubao-seed-2-0-pro-260215`）
- 观察契约、动作 schema 版本、**prompt digest**（如 `d3823a71…`、`84d5d829…`）
- 代码框架与作者来源（scripted 臂：`playwright-accessibility-locator` / `human`）
- 准入状态 `admission.status`（当前三个 v0.2 参考配置仍为 `not-started`）

**为什么这么做**：防止"供应商换了个模型版本"被误读成"策略族变了"。五个历史配置被显式标为 `legacy-pilot`，可读但**永远不能被重新标记成确认性证据**。

### 5.3 三个面板（论文冻结的目标规模）

| 面板 | 构成 | 计划执行数 | 当前 |
|---|---|---:|---|
| **本地参考面板** | 30 应用 × 8 工作流 × 3 条件 × 3 策略族 × 10 次独立 reset | 21,600 | 未采集 |
| **跨 Web 组合面板** | 15 个不相交应用对 × 2 个有向工作流 × 3 条件 × 3 族 × 10 次 | 2,700 | 未采集 |
| **配置复制面板** | 12 应用 × 4 工作流 × 3 条件 × 6 个非参考配置 × 6 次 | 5,184 | 未采集 |
| **合计** | | **29,484** | **0 条合格** |

30 个应用按 **6 个预注册领域层，每层 5 个**分配。跨 Web 面板单独分析，因为它改变了运维任务和 oracle 边界，**不是本地重复**。

> ⚠️ **口径提示（可能被追问）**：代码内部的 `phase2-scaling-plan.v0.1.json` 给的确认性目标区间是 **19,000–22,000**，近期 P1/P2/P3 三个面板合计 **2,295** 次。论文写的 29,484 是三面板设计口径，二者尚未统一，属于**待在预注册时裁定的开放项**（`PREREGISTRATION_DRAFT.md` 第 L 节明确列出）。答辩时应主动说明这是"设计目标 vs 功效模拟后待定"的关系。

### 5.4 为什么"每格 10 次独立 reset"

每次重复都是**独立 reset 的全新尝试，不是看到坏结果后重跑**。reset 失败、供应商中断、无效条件仍然产生一条记账记录，**不产生替换运行**。RQ3 的修复运行是独立的、快照隔离的队列，**不进任何分母**。

---

## 6. 一次运行的完整生命周期（这是答辩的核心流程图）

以 BookStack 导航任务为例，控制器是 `code/scripts/bookstack-navigation-matched-pilot.mjs`：

```
① 参数与随机化
   PSS_MATCHED_REPETITIONS / CUA_MAX_STEPS / CUA_TIMEOUT_MS / PSS_PILOT_CONDITION /
   PSS_UI_MUTATION / PSS_PILOT_RUN_TAG
   randomizedArms(rep) = 对 [playwright, visual, hybrid] 用
       sha256(seed|rep|arm) 的十六进制排序 → 每个 repetition 一个平衡臂序
   randomizationBlock = "<task>-<condition>[-tag]-r01-<臂序>"
        ↓
② 对每个 arm：独立 reset（含至多 2 次 predeclared 重试）
   node scripts/bookstack-lifecycle.mjs reset
   状态必须是 seed-verified / seeded，且必须返回 reset_digest
   → reset 失败直接记为 failure_category='environment' 的记账行，不重跑
        ↓
③ 执行
   playwright → scripts/run-bookstack-navigation-playwright.mjs
   visual/hybrid → scripts/run-bookstack-agent-pilot.mjs
        · 启动 chromium，viewport 固定 1280×720
        · 若 PSS_UI_MUTATION=bookstack-layout-v1 → installBookStackLayoutMutation(context)
        · 用 fixture 账号登录（登录是 fixture _setup，不是被测动作）
        · visual：每步只喂 JPEG 截图（quality 可配置）
          hybrid：喂截图 + hybridPageStructure()（最多 40/80 个可见控件，
                  每个给 role / name / 归一化中心坐标 / target_id）
        · 动作集：click / double_click / type / keypress / scroll / wait
                  （越界坐标直接抛错）
        · 每步写入 trace，并用 replay-artifacts 抓帧 + 状态里程碑
        ↓
④ 独立 Oracle（只轮询 oracle，绝不把结果喂回 agent）
   · bookstack-open-book / search-open-book2 → evaluateBookStackOpenBookPage()
       要求：精确 /books/<slug> 概览路由 + 精确书名标题可见
       拒绝：chapter / page / draft / editor 子孙路由
   · bookstack-create-page → 子进程 evaluate-bookstack-page.mjs
       检查持久化候选记录数与 clean/fault 签名匹配
   · 保存是异步的 → 只轮询 oracle，最多 PSS_ORACLE_POLL_MS（默认 5000ms）
        ↓
⑤ 结果派生（code/src/outcome-admission.mjs）
   taskStateReached   = oracle 通过
   protocolCompleted  = 无异常 ∧ status==='completed' ∧ 归一化 verdict === 期望 verdict
   oracleOnlySuccess  = taskStateReached ∧ ¬protocolCompleted   ← 关键！
   cellPassed         = taskStateReached ∧ protocolCompleted
        ↓
⑥ 失败分类（failure-taxonomy.mjs）
   perception / grounding / planning / execution / oracle / environment / task-defect /
   provider / provider-timeout / provider-api / provider-format / grounding-loop /
   agent-step-budget / termination-verdict / agent-verdict
        ↓
⑦ 写不可变 run record（追加写，mode 0600）
   v0.2 必填：configuration_id / strategy_family / protocol_version /
              run_manifest_digest / sut_image_digest / reset_digest / randomization_block
   timing: wall_time_ms / actions / retries / tokens / cost_usd（缺失保持 null，绝不填 0）
        ↓
⑧ 汇总与审计
   records:collect → records:audit（查重 + 缺臂）→ metrics:summarize
   → metrics:paired-clean-fault → report:phase2-evidence → dashboard:serve
```

### 6.1 每一步都有对应的可审计产物

| 环节 | 产物 |
|---|---|
| reset | `reset_digest`（如 BookStack `6246d6dbf78b…`、Indico `1ceb32dc…`） |
| 执行 | `artifacts/phase2/replays/` 下的逐帧截图 + 状态里程碑 + provider 事件摘要（本地忽略，不入库） |
| oracle | oracle 独立返回 `passed`，与 record 分开存储 |
| 记账 | `<task>-<condition>-<provider>-<model>-<tag>-records.jsonl` |
| 汇总 | 同名 `-pilot.json` / `-metrics.json` / `-variance.json` |
| 审计 | `records:audit` 在**三臂不齐时故意失败** |

---

## 7. 实验条件：三类条件，各自有准入门禁

| 条件族 | 定义 | 准入要求 |
|---|---|---|
| **Clean** | 执行预期行为 | 三参考族都在同一 reset digest 与预算下通过 clean 准入 |
| **Functional fault** | 注入版本化缺陷，其**外部可观测或持久化后果**由正 control 先确立 | 有独立核验的 trigger、前置条件、可观测后果；变异标识与评估结果**留在 oracle 侧** |
| **Ecological interface evolution** | 改界面但**业务语义与 oracle 结果不变** | 不变式套件（invariant suite）必须先证明：用户目标、业务状态转移、独立 oracle 三者都未变 |

**关键区分**：*"改了界面"不等于"演化"*。如果一个变体同时改了语义和界面，那次失败**不能**被解释成鲁棒性结果。专门设计来压测某一模态的变体叫 **stress probe**，单列，**永不与生态演化结果合并**。真实发布版本对（genuine release pair）也单列。

### 7.1 每个条件的五步门禁（论文 §4.5）

```
(i)  clean reset + 重复的传统 control 与 oracle 检查
(ii) 施加变异 + marker 检查
(iii) 确认故障能翻转 oracle，或演化能保持 oracle
(iv) 移除变异 + 全新 reset + clean 复检
(v)  用无关负 control 任务做隔离
```

这五步全过，条件才会被派发给三个参考策略。**施加失败、marker 缺失、不变式被违反 → 这是"无效实验条件"，不是一次成功或失败的测试执行。**

### 7.2 具体已实现的变异（`code/src/mutations/`）

- **BookStack 布局演化** `bookstack-layout-v1`：浏览器上下文级 CSS 改动（字体、间距、宽度、按钮形状），按构造不改变 DOM/ARIA 语义；但**光靠这一点不足以证明语义保持**，还需不变式套件通过。
- **BookStack 持久化故障** `persistence-mismatch`：可逆的、研究作用域内的数据库 trigger，使持久化的 title/body 签名与预期值不符。
- **Indico**：作用域内的事件元数据不匹配；**Juice Shop**：删除某一个具名搜索结果。

---

## 8. 指标体系：四个分量 + 一个联合终点

对每一次**已启动**的运行，我们记录四个量（论文公式 1）：

| 符号 | 名称 | 含义 |
|---|---|---|
| **P** | Protocol completion | 是否完成了声明的执行协议（正常终止并给出终态） |
| **S** | Task-state achievement | 是否**由独立 oracle 判定**达到了目标任务状态 |
| **C** | Verdict coverage | 是否**发出**了可用的 clean/fault 判定；`unknown`/未发出 → C=0 |
| **V** | Verdict correctness | 发出的判定是否与 oracle 的隐藏真值一致 |

$$\text{联合严格测试正确性 } J = P \land S \land V$$

**这个定义的杀伤力在于**：页面到了、智能体自报成功、或者只有 oracle 说状态对了——三种情况**都不能**产生严格通过。这就是 `oracleOnlySuccess` 这类记录被单独保留、但不计入成功的原因。

### 8.1 完整指标字典（`code/config/metric-dictionary.v0.1.json`，15 项）

| 族 | 指标 | 类型 | 定义要点 | 角色 |
|---|---|---|---|---|
| effectiveness | `valid_completion` | binary | 独立 oracle 确认检查点与后置条件 | **主** |
| effectiveness | `joint_end_to_end_correctness` | binary | valid_completion ∧ verdict_correct | **主** |
| oracle | `verdict_correct` | binary | 发出判定 == 盲态独立 gold 判定 | **主** |
| oracle | `false_positive_rate` | proportion | clean 被误报为 fault | **主** |
| oracle | `false_negative_rate` | proportion | fault 被报为 clean 或**未检出** | **主** |
| maintenance | `repair_success` | binary | 演化后修复并通过不变 oracle 的全部重放 | 主-次 |
| maintenance | `repair_time_minutes` | continuous | 从修复开始到验证成功或删失的**主动人分钟** | 主-次 |
| maintenance | `artifact_edit_size` | integer | 变更行数/编辑单元数 | 次 |
| reliability | `repetition_stability` | proportion | 同格重复运行的严格正确率 | 主-次 |
| efficiency | `wall_time_ms` | continuous | runner 启动到终态的墙钟时间，含供应商等待 | 次 |
| efficiency | `action_count` | integer | 已执行浏览器动作数；被拒决策单列为 retry | 次 |
| efficiency | `retry_rate` | proportion | 重试次数 / 决策机会数 | 次 |
| efficiency | `token_cost_usd` | continuous | token 与计费成本；**供应商不暴露则为 null，绝不补 0** | 次 |
| diagnostic | `failure_category_rate` | multinomial | 失败机制分布（互斥主类 + 可选子类） | 次 |
| oracle | `oracle_latency_ms` | continuous | 智能体终止后独立评估器耗时 | 次 |

### 8.2 聚合规则（防止 outcome shopping）

1. 主有效性指标**先按 任务×条件×臂×模型 单元**报告，再做宏聚合；
2. 宏平均对任务等权；微平均只作补充，并暴露分母敏感性；
3. 应用与任务在允许的规模下建模为**随机效应**；
4. 配对臂对比给**效应量与置信区间**，不只给 p 值；
5. 臂×条件、臂×模型交互是**预注册的调节项**；**禁止事后挑选赢家**。

---

## 9. 随机化、重复与失败保留

- **区块随机化**：在 应用×工作流×条件 区块内，用 `sha256(seed|repetition|arm)` 排序产生平衡臂序；臂序本身写入 `randomization_block` 字段。
- **独立 reset**：每个 arm 执行前都重新 reset，最多 2 次**预先声明**的重试，重试次数以 `reset_attempts` / `reset_retry_used` 形式**保留在账本里，绝不静默删除**。
- **失败即证据**：provider 中断、浏览器崩溃、非法动作、超时、评估器失败、reset 失败各有**独立状态码**，全部留在分母里。
- **运行标签隔离**：`PSS_PILOT_RUN_TAG` 让"换了执行上下文的重跑"写进**新的**摘要与 JSONL，而不是追加到旧账本。它是隔离标签，**不是实验条件**。

---

## 10. 分析计划（论文 §3.8，已冻结）

- **主模型**：分层 logistic 混合效应模型
  - 固定效应：策略族、条件、族×条件交互（+ 预注册的任务复杂度协变量）
  - 随机截距：应用、工作流
- **报告**：绝对分母 → 配对风险差 → 比值比 → 95% CI
- **多重性**：主族的两两对比用 **Holm** 校正；探索性机制/亚组分析用**单独声明的 FDR** 程序
- **修复时间**：删失规则**在看结果之前**声明，不只统计修复成功的样本
- **偏差台账**：日期、受影响单元、原因、补救、每条观测的处置——全部入账

诊断与任何"有正当理由的偏离计划模型"都保留在制品中。

---

## 11. 工程实现一览（可复现性证据）

| 类别 | 内容 |
|---|---|
| 代码规模 | `code/src/` 20 个 `.mjs` 模块 + 3 个子目录（arms / mutations / oracles）、`code/scripts/` 61 个脚本（58 `.mjs` + 3 `.py`）、`code/config/` 17 份配置、`code/schemas/` 3 份 JSON Schema |
| 契约测试 | **34 个测试文件 / 102 条测试，当前全部通过**（`npm run test:contracts`） |
| 资产校验 | `validate:study-assets` → 8 条文献引用、15 项指标、8 个任务蓝图、8 个复制用例，全部通过 |
| Manifest | `validate:manifests` → 3 个应用、6 个任务，参考截止 2023-01-01，通过 |
| Benchmark matrix | `validate:benchmark-matrix` → 3 应用、24 工作流、5 个模型层、5 个传统基线，通过 |
| Scaling plan | `validate:phase2-scaling-plan` → 3 个近期面板、2,295 计划运行、确认性目标 19,000–22,000，通过 |
| 本地可观测 | `npm run dashboard:serve` → 只读本地面板，SSE 每 2.5 秒刷新，只服务 loopback，绝不提供 `.env`/prompt/凭据/oracle 状态 |

### 11.1 常用命令链（答辩时可以直接贴）

```sh
cd code
# 环境与门禁
npm run validate:manifests && npm run validate:configuration-registry
npm run test:adapter-conformance          # provider-free 隔离门禁

# SUT 生命周期
npm run sut:bookstack:reset               # 返回 reset_digest
npm run oracle:bookstack

# 跑一个配对的 clean 区块
PSS_MATCHED_REPETITIONS=1 CUA_MAX_STEPS=8 CUA_TIMEOUT_MS=30000 \
  npm run pilot:bookstack:navigation

# 跑布局演化区块（只改 condition/mutation 标签）
PSS_PILOT_CONDITION=ui-evolution:bookstack-layout-v1 \
PSS_UI_MUTATION=bookstack-layout-v1 PSS_MATCHED_REPETITIONS=1 \
  npm run pilot:bookstack:navigation

# 记账链路
npm run records:collect -- --input ../artifacts/phase2/<...>-records.jsonl
npm run records:audit   -- ../artifacts/phase2/<...>-records.jsonl   # 三臂不齐则失败
npm run metrics:summarize -- --input <...>.jsonl --output <...>-metrics.json
npm run metrics:paired-clean-fault
npm run report:phase2-evidence
```

### 11.2 外部框架适配器（可选的泛化层，不进主三臂账本）

| 框架 | 版本 | 当前证据 | 边界 |
|---|---|---|---|
| Browser Use | 0.13.10 | BookStack 已认证导航到达 `/books/book`；5 步 / 31,898 ms；写入 v0.2 记录 + 4 帧重放 | 探索性 smoke，**非配对** |
| Stagehand | 3.0.8 | 自定义 `LLMClient` 把 Qwen 接到阿里兼容端点；`act` 拿截图 + Stagehand a11y 快照；记录与重放通过注册表校验 | 内置 AI-SDK `agent.execute` 与 Qwen 消息 schema 不兼容；可见定位器回退**在重放中显式标记**，不算纯模型成功 |
| AgentLab/BrowserGym | 0.4.2 / 0.14.2 | `pss-bookstack-open-book` 的 setup/observation/oracle 适配器已实现 | 模型驱动的 AgentLab policy **尚未准入** |

---

## 12. 当前就绪度总览（一句话版本）

**工程链路已打通并可审计：102 条契约测试通过、全部资产校验通过、三 SUT 可确定性 reset、独立 oracle 已实现、重放与溯源链路可用；但实验数据仍停留在可行性/准入 pilot 阶段，确认性台账为 0 条，冻结与预注册尚未完成。**

---

## 13. 可能被追问的问题（A 篇）

**Q：为什么不直接比较"截图 vs DOM"，而是要比较三个包裹？**
因为实际部署时，你不可能只换观察输入而不换动作接口、框架、编写产物和模型。把它当成纯因果的"模态效应"会**高估**一次实用评估能识别的东西。所以我们诚实地把估计量定义为"部署包裹对比"，并在论文里明确写：本研究支持部署决策，**不支持**"某种信息模态本质上导致某种测试结果"的因果主张。

**Q：三臂公平吗？智能体要等模型推理，脚本不用。**
我们**不隐藏**这些差异：推理延迟、框架开销、重试行为、编写/修复工作量全部记录并单独报告，而不是塞进一句"我们很公平"。真正被强制相同的是：意图、fixture、起始状态、浏览器与 viewport、测试账号、条件、**独立 oracle**、时间预算、动作预算、以及每臂独立 reset。

**Q：为什么不把 Selenium / CSS-XPath 也加进主对比？**
它们被登记为探索性基线（`planned-exploratory`）。主对比要的是"有代表性的工程基线"，加一个被削弱的对照组只会制造容易赢的稻草人。

**Q：29,484 和内部的 19,000–22,000 哪个为准？**
29,484 是论文冻结的**三面板设计口径**；19,000–22,000 是代码内部 scaling plan 的目标区间。论文 §2.4 明确写了：在首次确认性运行前，要用**准入 pilot 的方差估计、工作流内相关性和预注册的最小实际重要效应**做事前功效分析，要么追认要么在版本化预注册中修订。这属于第 L 节列出的开放决策，尚未裁定。

**Q：pilot 数据能不能算结果？**
不能。详见陈述稿 B。核心理由：单应用、单工作流、单供应商/模型层、每格 n=3，且协议版本未冻结。

---

*配套文档：`defense-script-B-data-provenance-and-results-2026-09-09.md`*
