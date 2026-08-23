# PSS-WebTest 原始项目清单状态审计

更新时间：2026-08-23

本文件逐项对照早期的 [`ALL_PHASES_PLAN_ZH.md`](ALL_PHASES_PLAN_ZH.md)、[`PROJECT_EXECUTION_PLAN.md`](PROJECT_EXECUTION_PLAN.md)、[`PREREGISTRATION_DRAFT.md`](PREREGISTRATION_DRAFT.md) 和两日启动清单，使用当前仓库代码、最新进度日志与 gitignored pilot artifacts 重新判定状态。

状态含义：

- **已完成（PASS）**：已有可复核的代码、测试或实验 artifact 支持，且不依赖未完成的后续 gate。
- **部分完成（PARTIAL）**：基础设施或局部证据已具备，但尚未满足该清单项的完整退出条件。
- **未完成（OPEN）**：尚未执行、尚未冻结，或被前置 admission gate 阻塞。
- **已调整（REFRAMED）**：原始表述过窄，已按当前研究目标改为条件化、多模型、多传统方法的 benchmark 计划。

## 1. 总体结论

项目目前处于：

> **Phase 2 后半段的 feasibility/admission pilot；尚未进入 Phase 3 完整 benchmark 构建、Phase 5 最终 power freeze、Phase 6 protocol freeze 或 Phase 7 confirmatory collection。**

最重要的进展是：BookStack 已完成 3 repetitions × 3 arms 的 clean pilot，9/9 独立 oracle 通过；Indico 和 Juice Shop 已完成真实 1 repetition × 3 arms 的 clean pilot，但均为 Playwright 1/1、visual 0/1、hybrid 0/1。所有三个 SUT 的 reset、传统 baseline 和独立 oracle 基础已通过，当前主要瓶颈转为 CUA 多步 grounding 与可泛化稳定性。

## 2. Phase 0：项目与开放边界初始化

| 原始清单项 | 状态 | 证据/说明 |
|---|---|---|
| 建立 GitHub public 实验仓库 | **PASS** | `https://github.com/WANGLEVY9/PSS-WebTest`；当前 `main` 与 `origin/main` 同步 |
| Node/Playwright 工程、manifest/schema、README | **PASS** | `code/`、task manifests、validator 和 contract tests 已存在 |
| `paper/`、密钥、原始 trace、私有第三方材料不进入 public repo | **PASS** | 当前 `git status` clean；`paper/` 与 artifacts 被忽略；public-boundary tests 已通过 |
| 可公开复现实验代码安装和基本验证 | **PASS** | `npm run test:contracts` 当前 31/31 通过；manifest validation 已有脚本 |
| Phase 0 退出条件 | **PASS** | 无论文源码、凭证或 raw private trace 被公共仓库跟踪 |

## 3. Phase 1：文献、冲突审计与研究冻结

| 原始清单项 | 状态 | 证据/说明 |
|---|---|---|
| 以 2023 年后工作为主要证据进行滚雪球检索 | **PASS** | `phase1-expanded-search-2026-08-15.md`、`phase1-master-synthesis.md` |
| 精读 WebTestPilot、Chevrot、WebTestBench、Anchor/ERP-Bench、oracle 审计工作 | **PASS** | `deep-read-notes.md`、`phase1-collision-freeze.md` |
| 识别直接冲突并保留来源依据 | **PASS** | WebTestPilot 被标为 partial direct conflict；未发现完整三臂 matched Web software testing 冲突 |
| 冻结 visual / hybrid / accessibility-locator Playwright 三臂 | **PASS** | observation contracts、confirmatory design v0.2 |
| 冻结 independent oracle、fault/evolution、repair、cost、latency、stability outcomes | **PASS** | `PROJECT_EXECUTION_PLAN.md`、`PREREGISTRATION_DRAFT.md`、`phase2-confirmatory-design-v0.2.md` |
| 冻结禁止的 novelty claim | **PASS** | 不再宣称“第一个 CUA-vs-Playwright”；不宣称普遍赢家 |
| Phase 1 退出条件 | **PASS** | 结论为 **GO with bounded claims** |

## 4. Phase 2：SUT/vertical slice/可行性

| 原始清单项 | 状态 | 证据/说明 |
|---|---|---|
| 候选 SUT license、版本、架构和运行风险审计 | **PASS** | `phase2-feasibility-audit.md`、`sut-candidate-audit.csv` |
| BookStack、Indico、Juice Shop reset/ready/stop 生命周期 | **PASS** | 三套 lifecycle 脚本与最新 clean-state gates 均可运行 |
| BookStack 传统 workflow + persisted DB oracle | **PASS** | 3/3 clean baseline；最新三臂 artifact 的 9 个 reset/clean/oracle gate 全通过 |
| Indico 登录→创建事件→PostgreSQL oracle | **PASS** | authenticated Playwright baseline 通过；本地实验账号仅存于 `code/.env` |
| Juice Shop product-search + UI/REST evaluator | **PASS** | overlay gate 修复后 Playwright 1/1；visible UI oracle 已通过 live traditional flow |
| BookStack functional fault + layout evolution smoke | **PASS** | harness、oracle 和 rollback/isolation smoke 已验证 |
| Indico transactional fault workflow live gate | **PASS** | apply、页面 fault visibility、独立 PostgreSQL detection、remove、isolation 均通过 |
| Juice Shop omission/layout live gate | **PASS** | omission 使 UI oracle 失败；layout evolution 保持 oracle 通过 |
| Pure-visual observation isolation | **PASS** | contract tests 拒绝 DOM/accessibility/hidden evaluator fields |
| Hybrid anti-leakage contract | **PASS** | nested hidden fields 被拒绝；当前 contract suite 31/31 |
| 真实 CUA provider 配置与图像连通性 | **PASS（仅 connectivity）** | Alibaba `qwen3-vl-flash` 对 visual/hybrid screenshot 输入返回 HTTP 200 和可解析 function call |
| BookStack clean 三臂 matched pilot | **PASS（pilot admission）** | 3×3，9/9 independent oracle pass；artifact 明确 `confirmatory=false` |
| Indico clean 三臂 matched pilot | **PARTIAL** | 1×3：Playwright 1/1，visual 0/1，hybrid 0/1；reset/clean gates 通过 |
| Juice Shop clean 三臂 matched pilot | **PARTIAL** | 1×3：Playwright 1/1，visual 0/1，hybrid 0/1；reset/clean gates 通过 |
| 全部三臂在至少一个任务上达到可重复 pilot reliability | **PARTIAL** | BookStack 已达到；跨 SUT 泛化尚未达到 |
| Phase 2 总体退出条件 | **OPEN** | Indico/Juice CUA admission 未通过；fault/evolution agent blocks 尚未采集 |

## 5. Phase 3：Benchmark 正式设计

| 原始清单项 | 状态 | 证据/说明 |
|---|---|---|
| 选择 3–4 个不同领域 SUT | **PARTIAL** | 当前有 3 个可运行 SUT；尚未完成第四个或外部 holdout SUT 决策 |
| 每个 SUT 设计 4–6 个代表性 workflow | **OPEN** | 当前每个 SUT 只有一个 vertical-slice task |
| 覆盖 CRUD、multi-step form、search/filter、权限、跨页状态、数据依赖 | **PARTIAL** | 设计已列出，但尚未实现成任务集 |
| visible/persisted/relational/oracle strata | **PARTIAL** | visible、persisted、relational 已有实现；visual/usability oracle 尚未形成 confirmatory protocol |
| clean/fault 配对版本 | **PARTIAL** | harness 已有，但 Indico/Juice agent fault blocks 尚未运行 |
| behavior-preserving UI evolution matrix | **PARTIAL** | 设计和部分 live mutations 已有；完整任务矩阵、独立 invariant suite 和三臂运行尚未完成 |
| positive/negative/evaluator unit tests | **PARTIAL** | oracle/mutation/contract tests 已有；完整任务族的正反例尚未建立 |
| 版本、镜像 digest、fixture、oracle、mutation manifest 冻结 | **OPEN** | 需在最终任务矩阵确定后一次性冻结 |
| Phase 3 退出条件 | **OPEN** | 目前仍是 vertical slice，不是充分 benchmark |

## 6. Phase 4：统一 Harness 与三臂实现

| 原始清单项 | 状态 | 证据/说明 |
|---|---|---|
| 三个 arm adapter | **PASS** | visual、hybrid、Playwright runner 均已实现 |
| provider-neutral action schema | **PASS** | Volcengine/Alibaba driver 统一转为受限 action schema |
| trace、latency、retry、cost、provenance、artifact hash | **PARTIAL** | visual/hybrid 已标准化；token/cost 受 provider 返回能力限制；Playwright 尚未完全同 schema |
| immutable run-record schema + collector | **PASS** | SHA-256 trace hash、敏感字段拒绝、JSONL collector 已通过 tests |
| 三臂统一 run ledger | **PARTIAL** | 当前 agent ledger 主要为 visual/hybrid；Playwright 需统一写入相同 record schema |
| evidence admission pipeline | **PARTIAL** | schema 和 gate 规则已存在；confirmatory admission 尚未打开 |
| arm isolation/leakage tests | **PASS** | visual/hybrid hidden-field tests 通过 |
| Phase 4 退出条件 | **OPEN** | 统一三臂 ledger 和全任务运行尚未完成 |

## 7. Phase 5：Pilot、成本与 power

| 原始清单项 | 状态 | 证据/说明 |
|---|---|---|
| clean pilot | **PARTIAL** | BookStack 3×3；Indico/Juice 1×3 |
| fault pilot | **OPEN** | fault harness gate 通过，但三臂 agent fault runs 尚未采集 |
| evolution pilot | **OPEN** | mutation gate 通过，但三臂 agent evolution/repair runs 尚未采集 |
| repeated-run stability pilot | **PARTIAL** | BookStack clean 有 3 repetitions/arm；跨任务和条件不足 |
| cost/latency/retry distribution | **PARTIAL** | latency/retry 已记录；多模型成本和完整 token accounting 尚未建立 |
| failure taxonomy | **PARTIAL** | provider abort、timeout、invalid action、grounding failure 等已有分类；尚未覆盖全部任务/模型 |
| pilot-based variance freeze | **OPEN** | BookStack clean 9/9 导致几乎没有 arm variance；需 fault/evolution/更多 task |
| final repetition number | **OPEN** | 之前的 power simulation 仅规划性，不得冻结最终 repetition |
| Phase 5 退出条件 | **OPEN** | 尚未有足够 variance 输入支持最终 power decision |

## 8. Phase 6：预注册与协议冻结

| 原始清单项 | 状态 | 证据/说明 |
|---|---|---|
| RQ、primary outcomes、exclusion、missingness 草案 | **PARTIAL** | `PREREGISTRATION_DRAFT.md` 与 confirmatory design v0.2 已有草案 |
| 最终应用和版本/license | **OPEN** | benchmark workflow 扩展前不能冻结 |
| 最终 model/provider 与 replication policy | **OPEN** | 当前只验证 Qwen3-VL；多模型计划尚未落实 |
| exact task/mutation manifest | **OPEN** | 当前仅 vertical slice |
| MDE、power、repetition、budget | **OPEN** | 需完成 pilot variance 后冻结 |
| deviation log、协议 hash、注册平台 | **OPEN** | 尚未开始正式 preregistration |

## 9. Phase 7–9：Confirmatory、分析、论文和 artifact

| 原始阶段 | 状态 | 当前判断 |
|---|---|---|
| Phase 7 Confirmatory collection | **OPEN** | 尚未开始；按预注册顺序继续冻结 |
| Phase 8 statistical analysis | **OPEN** | 只有 feasibility summaries，没有 confirmatory effect estimates |
| Phase 8 decision-boundary model | **OPEN** | 需要完整 benchmark 数据和 held-out validation 设计 |
| Phase 9 public replication artifact | **PARTIAL** | public code、schemas、harness 和 docs 已有；最终 sanitized dataset、重分析脚本和 clean-room reproduction 尚未完成 |
| Phase 9 paper skeleton | **PARTIAL** | ISSTA 2026 单栏骨架已建立，但论文结果部分必须等待实验完成 |

## 10. 原始 immediate actions 对照

| 原始动作 | 当前状态 |
|---|---|
| 选择并记录真实 CUA provider/model | **PARTIAL→已解决 connectivity**：Alibaba `qwen3-vl-flash` 可用；尚未完成多模型矩阵 |
| BookStack visual/hybrid 真实运行 | **PASS（clean pilot）**：3/3/arm；仍需跨任务验证 |
| Indico/Juice fault/evolution | **PARTIAL**：harness/live gate 通过，agent blocks 未运行 |
| 小规模 cost/latency/reliability pilot | **PARTIAL**：已有真实 latency/retry/run-record；跨模型和完整条件不足 |
| 根据 pilot 冻结 power/repetitions/budget | **OPEN** |
| 冻结 preregistration 后采集 confirmatory 数据 | **OPEN** |

## 11. 当前最关键的研究判断

现在不能把项目描述成“已经完成三臂比较”，也不能把 BookStack 9/9 解释成三种方法等价。正确的表述是：

1. 我们已经证明了一个可审计的三臂 Web testing vertical slice 可以运行。
2. 我们已经证明了 fault/evolution harness 和独立 oracle 可以运行。
3. 我们还没有证明 CUA 的稳定性能够跨 SUT、任务和 UI 条件泛化。
4. 当前最重要的科研对象不是全局 winner，而是 `arm × model × task × oracle × evolution` 的条件化表现曲面。
5. 如果后续 CUA 在某些条件下更好、传统测试在另一些条件下更好、hybrid 在第三类条件下更好，这三类结果都属于目标发现，而不是失败。

