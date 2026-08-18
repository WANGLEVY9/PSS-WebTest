# Phase 2 confirmatory-design gate v0.2

更新时间：2026-08-18。本文是实验设计与执行 gate，不是结果论文；当前所有 agent 结果仍属于 feasibility/pilot，不能进入 confirmatory effect estimates。

## 1. 实验单位与比较对象

实验单位是一次 `application × task × condition × arm × repetition` 运行。三臂是部署策略 bundle，而不是只改变观察模态：

1. `visual`：截图-only CUA；
2. `hybrid`：截图 + 明确声明的 page structure（role/name/state/稳定 harness reference），禁止 evaluator/application hidden state；
3. `playwright`：固定 accessibility-locator 脚本。

同一 task intent、reset snapshot、浏览器 viewport、timeout、action budget、oracle 和 condition 必须跨臂保持一致。模型/provider、prompt、locator policy 和 artifact 类型作为 arm 定义的一部分冻结。

## 2. 当前可执行 pilot tier

| SUT | task | 当前状态 | 是否可进 confirmatory |
|---|---|---|---|
| BookStack | create page/persist | reset、Playwright、DB oracle、fault/evolution smoke 已通过 | 否，需真实 visual + hybrid 三臂及矩阵补齐 |
| Indico | create event/persist | reset、Playwright、PostgreSQL oracle 已通过 | 否，需 fault/evolution 与 agent adapter |
| Juice Shop | product search | reset、Playwright、REST + visible UI oracle 已通过 | 否，完整 pure-visual 仍不稳定 |

`submit-only` Juice Shop 任务（fixture 预填 query、预打开 search）只用于定位键盘执行能力，不能与完整导航任务混合，也不能作为完整 CUA 成功率。

## 3. Confirmatory admission gate

某个 task-condition cell 只有同时满足以下条件才可进入 confirmatory ledger：

- 三臂各完成至少 3 次 clean baseline，reset 前后状态 hash 一致；
- 三臂使用同一个自然语言 intent 和相同预算；
- 每次运行均生成合法 run record、trace hash 和 observation-contract label；
- independent UI/persisted/relational oracle 在 evaluator 侧运行，不读取 agent verdict/action history；
- functional fault 的存在由 fault oracle 预先证明；UI evolution 的行为保持由传统 baseline + oracle 预先证明；
- timeout、invalid action、model refusal、browser crash 和 infrastructure error 保留为结果，不删除；
- task fixture、prompt、model/provider、viewport、action schema 和版本 digest 已冻结。

未通过 admission gate 的运行只能进入 `pilot` 或 `excluded-with-reason`，不得汇总为 arm effectiveness。

## 4. 条件矩阵（冻结前版本）

每个 admitted task 至少包含：

- `clean-stable`：无 fault、无 evolution；
- `functional-fault`：一个预先验证的状态/持久化/验证错误；
- `dom-preserving-evolution`：DOM/layout implementation 改变但语义保持；
- `accessibility-evolution`：accessible name/role/structure 改变，需明确是否仍在 task contract 允许范围；
- `visual-layout-evolution`：视觉布局改变但业务语义保持；
- `runtime-evolution`：延迟/异步顺序变化但最终业务语义保持。

modality-adversarial probes 单独标记为 `stress`，不与生态 evolution 条件混合，也不用于 prevalence claim。

## 5. Primary outcomes

每次运行必须同时记录三类结果：

1. `valid_completion`：独立 evaluator 证明 task checkpoint 达成；
2. `verdict_correct`：在 clean/fault condition 上，agent verdict 与隐藏 gold verdict 一致；
3. `repair_success`：evolution 后在不改 SUT/intent/oracle 的条件下修复并通过 3 次复验。

联合端到端 correctness 使用 `valid_completion AND verdict_correct`，并同时报告 coverage、false positive、false negative；不能只分析成功执行的 runs。

repair 记录 active person-minutes、edit count、changed artifact size、是否成功、censoring reason 和复验结果。

## 6. 运行与随机化

- 在 `application × task × condition` block 内随机打乱 arm 顺序；
- 每个 arm 使用独立 reset；
- confirmatory runs 不允许 prompt 迭代或人工干预；
- provider outage、reset failure 和 evaluator failure 分别分类；仅在预注册规则允许时重跑；
- 每次 run 的原始 observation/action trace 不覆盖，record append-only；
- 运行日志不得包含 API key、账号密码、hidden oracle 值或未脱敏页面 secrets。

## 7. 统计冻结要求

当前不宣称样本量已足够。完成 pilot 后，用 task-level paired outcomes 估计相关性和方差，模拟 mixed-effects logistic model 的 power；在看到 confirmatory arm outcome 前冻结：

- 最小实际重要风险差/odds ratio；
- broad tier 和 reliability tier repetition 数；
- arm × condition、arm × oracle 交互项；
- application/task random intercept；
- primary-family Holm correction；
- repair time 的 survival/two-part model 和 censoring 规则。

## 8. Phase 2 当前退出条件

Phase 2 只有在以下清单全部满足后退出：

- [x] 三个 SUT reset 与传统 task/oracle feasibility；
- [x] visual observation contract 与 hybrid anti-leakage contract；
- [x] Volcengine provider 文本/图片/结构化响应 smoke；
- [x] visible UI oracle 的 fake-page 与 live traditional-flow 验证；
- [ ] pure-visual 完整多步 task 在固定预算下达到预设 pilot reliability；
- [ ] hybrid 真实 provider driver + 至少一个真实 SUT pilot（driver/contract 已通过；真实 pageStructure 外发需额外授权）；
- [x] Indico/Juice Shop fault/evolution harness live gate（Indico transactional trigger、登录→创建→fault→独立 fault-aware oracle、Juice page-local omission/layout 均已通过）；
- [ ] 标准 run-record 批量生成、schema validation 和 ledger admission（schema/collector/visual runner 已接入，尚需批量 ledger）；
- [ ] matched three-arm cell 的最小 confirmatory admission；
- [ ] pilot-based power simulation 与 preregistration decision freeze。

在未完成最后五项前，不生成论文中的 confirmatory comparison table，不报告“哪个 arm 更好”的总体结论。
