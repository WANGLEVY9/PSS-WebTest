# PSS-WebTest 全阶段目标与工作计划

更新时间：2026-08-16

## 总体研究目标

在 matched Web 测试意图、受控功能缺陷、不同 oracle authority 和行为保持的 UI 演化条件下，比较纯视觉 CUA、视觉加结构信息的混合 Agent、以及 accessibility-locator Playwright 测试套件的端到端正确性、修复结果、成本、延迟与重复稳定性，并形成可复现的适用边界，而不是宣称存在一个对所有场景都最优的方法。

## Phase 0：项目与开放边界初始化

**目标：** 建立可公开跟踪实验代码、同时不泄露论文稿件的工作区。

**工作：**

- 初始化 GitHub 仓库、Node/Playwright 工程和研究目录。
- 将 `paper/`、投稿材料、密钥、原始运行日志与本地第三方源码排除在 public Git 之外。
- 建立 public-boundary 自动检查与基本 README。

**退出条件：** 公开仓库可复现安装；论文与秘密文件未被跟踪。

**当前状态：已完成。**

## Phase 1：文献调研、冲突审计与研究冻结

**目标：** 将研究从宽泛问题收敛为可实验、可预注册的比较设计。

**工作：**

- 以 2023 年之后的 CUA、Web-agent、自动测试和 benchmark 工作为主要证据；早期论文仅作方法史背景。
- 对直接冲突、近邻工作、benchmark/harness 三个层级进行滚雪球检索。
- 冻结三臂、RQ1–RQ5、oracle authority、主要结果和禁止宣称。
- 明确主实验比较的是三种“部署策略 bundle”；用嵌套诊断实验研究纯 modality 效应。

**退出条件：** 未发现完整三臂、matched、fault/evolution/oracle-audited 的直接冲突；若发现则转为 replication/extension。

**当前状态：已完成，结论为 GO with bounded claims。**

## Phase 2：可行性、SUT/benchmark 选型与 vertical slice

**目标：** 证明研究对象能在本地被固定版本启动、确定性复位、独立评分，并让三臂在同一任务接口上运行。

**工作：**

1. 审计候选 SUT 的许可证、固定版本、架构、账户、reset、hidden oracle 和 UI mutation 可行性。
2. 对 BookStack、Indico 和至少一个 fallback 执行两轮 clean start/reset。
3. 为每个候选实现 `start/ready/login/snapshot/reset/stop`。
4. 实现一个 BookStack vertical slice：Playwright workflow、独立数据库 oracle、一次功能缺陷和一次行为保持 UI 演化。
5. 实现三臂 observation contract 和 leakage test。
6. 完成非 confirmatory 的成本、延迟与重复运行 smoke pilot。
7. 记录镜像 digest、宿主与 VM 架构、浏览器版本和所有 blocker。

**退出条件：** 至少三个候选可确定性 reset；至少一个任务三臂均能运行；oracle 与 arm 隔离；资源预算可接受。

**当前状态：进行中，三个候选的 reset 与任务级 oracle 子门槛已通过。** Node/Playwright 工程、manifest/schema、三臂 observation contract 与泄漏测试均已实现；Colima/Docker 和系统 Chrome 已通过可行性验证。BookStack 已完成 10/10 clean reset/workflow/oracle pilot、一次行为保持 UI mutation 和一次可检出的持久化功能缺陷。Indico 已完成三轮六服务 clean-volume reset、自动恢复恰好 18 个 seed event，并完成 create-event + PostgreSQL oracle；Juice Shop v20.0.0 已完成两轮固定镜像 ephemeral reset，并完成 product-search + REST oracle。尚未完成真实 pure-visual/hybrid provider 执行，Indico/Juice Shop 的 fault/evolution 条件仍待补齐，因此 Phase 2 整体尚未退出。

## Phase 3：Benchmark 正式设计

**目标：** 将可运行的 vertical slice 扩展为冻结前的任务、缺陷和演化矩阵。

**工作：**

- 确定 3–4 个 SUT、每个 4–6 个代表性 workflow。
- 定义 visible-state、persisted-state、relational 和 exploratory visual/usability oracle strata。
- 构建 clean/fault 配对版本及 functional fault manifest。
- 将生态 UI 演化与 modality-adversarial stress test 分开。
- 为每个任务准备正例、反例和 evaluator unit tests。

**退出条件：** 每个 confirmatory task 有机器可检查的独立 oracle；mutation 经传统 oracle 证明行为保持；任务清单具备版本与哈希。

## Phase 4：统一 Harness 与三臂实现

**目标：** 在相同 reset、任务意图、预算和 evaluator 下运行三种策略。

**工作：**

- 实现 pure-visual、hybrid 和 Playwright adapters。
- 记录完整 action/observation trajectory、成本、token、延迟、retry 和 artifact hash。
- 建立不可变 run ledger 和证据 admission pipeline。
- 对视觉 arm 执行结构信息泄漏测试，对所有 arm 禁止 hidden oracle 泄漏。

**退出条件：** arm isolation 测试通过；同一任务能被三臂执行；失败状态不会被错误折叠。

## Phase 5：Pilot、成本评估与统计功效

**目标：** 用非 confirmatory 数据估计方差、故障分布、运行预算和所需重复次数。

**工作：**

- 在分层小样本上执行 clean/fault/evolution/repeated-run pilot。
- 估计环境噪声、Agent 随机性、成本和 latency 分布。
- 冻结 practically meaningful effect 和 simulation-based power analysis。
- 调整任务规模，但不得依据哪一臂表现更好来筛选任务。

**退出条件：** 有可负担且能检测目标效应的采样方案；主要模型可稳定拟合。

## Phase 6：预注册与协议冻结

**目标：** 在看到 confirmatory 结果之前冻结研究决策。

**工作：**

- 冻结任务、SUT、fault/evolution manifest、模型版本、prompt、预算、重复次数和排除规则。
- 冻结主要结果、模型公式、交互项、多重比较和 censoring 规则。
- 生成协议、代码、镜像和 evaluator 哈希并时间戳保存。

**退出条件：** preregistration 可审计；之后变更全部进入 deviation log。

## Phase 7：Confirmatory 数据采集

**目标：** 按冻结协议运行完整实验，不进行结果导向调整。

**工作：**

- 在 application × task × condition × arm block 内随机化执行顺序。
- 收集 broad tier 与 reliability tier 数据。
- 保持 raw ledger append-only；区分 timeout、model refusal、environment error、evaluator error 和真实 test failure。
- 对 repair study 记录语义保持、成功/失败和主动人工工时。

**退出条件：** 达到预注册完整性阈值；缺失与偏差都有明确记录。

## Phase 8：统计分析、稳健性与适用边界

**目标：** 回答 RQ1–RQ5，并明确什么条件下哪种策略更合适。

**工作：**

- 估计 mixed-effects models、边际风险差、置信区间和 false positive/negative rate。
- 对成本、延迟、repair censoring、leave-one-application-out 和 oracle/evolution strata 做稳健性分析。
- 形成 decision-boundary model；若没有 held-out 验证则明确标记为 exploratory。
- 从 raw ledger 独立重建表格和图。

**退出条件：** 主结果可从原始记录自动复现；结论与证据强度一致。

## Phase 9：论文、开放工件与投稿

**目标：** 完成可审计论文和可复现 artifact，同时保持 public/private 边界。

**工作：**

- 完成 TSE 风格主稿、相关工作、设计、结果和 threats。
- 清理公开 replication package，提供安装、reset、运行和重分析说明。
- 复核 2023 年之后的最新相关工作与潜在冲突。
- 执行内部审稿、artifact clean-room reproduction 和投稿检查。

**退出条件：** 每项 claim 可追溯到结果；公开 artifact 从干净环境运行；论文材料仍不进入 public 实验仓库。
