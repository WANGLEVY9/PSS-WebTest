# 实验地图与操作速查

[项目首页](../README.zh-CN.md) · [English](EXPERIMENTS.md) · [研究设计与 RQ](RESEARCH.md) · [复现层级](REPRODUCIBILITY.md)

本页汇总研究包含的实验单元、各方法如何执行和评分，以及当前可开展的准备工作。benchmark 语义见[技术文档索引](technical/README.md)；当前 WAV 的主机和配置交接见[WAV 操作指南](EXPERIMENT-OPERATIONS.zh-CN.md)。

## 先区分两个研究计划

| 计划 | Benchmark 与分母 | 配置与重复 | 状态 |
|---|---|---|---|
| 当前开发批次 | 120 个 WAV 任务；每题对应三个 agent 单元及一份共享 Playwright 基线 | GPT-6 Astra、GPT-5.6 Sol；一轮计划为 720 次 agent 执行和 120 次脚本执行，共 840 次 | Planning/development 阶段。task ID 未冻结，API 身份和部署未绑定；派发器不可用；当前计划未授权运行或确证性采集。 |
| 历史论文设计 pss-manuscript-v2.1 | WAV 600、VWA 700、ATA 113，共 1,413 题 | 六个模型标签 × 三种 agent 单元，加一份共享脚本；D1–D2 discovery 与 V1–V10 validation，共 12 轮 | 论文设计和分析合同，不是当前调度方案或已完成运行。322,164 是计划执行机会数。 |

模型展示标签不是实际 API model ID。任何实测批次都须在运行前冻结真实提供方与返回模型身份、任务 ID、框架版本、输入边界、预算、环境版本和 evaluator 版本。不要把历史合同分母与 WAV-only 计划混用。

## Benchmark 速查

| Benchmark | 任务与环境 | 执行后如何判定 | 主要准备门槛 | 深入说明 |
|---|---|---|---|---|
| **WAV** | 固定 WebArena-Verified 源版本与官方 task ID；只部署冻结名单涉及的站点。每次执行绑定相同起始页、登录与任务输入，并独立恢复 fixture。 | 保存 agent 原始 FinalAgentResponse 和完整 HAR。关闭浏览器后调用固定版本的原生 evaluator；actor 超时不能被之后的评分覆盖。 | 当前 120 个 task ID、GPT API ID、Linux 依赖锁、站点闭包、reset/隔离、四种 profile 的原生正负控制和批量 dispatcher 均待完成。 | [WAV 规格](technical/benchmarks/WAV.md) · [操作指南](EXPERIMENT-OPERATIONS.zh-CN.md) · [生命周期/验收 runbook](../code/docs/runbooks/ACCEPTANCE-RUNBOOK.md) |
| **VWA** | 固定 VisualWebArena 源和带 site namespace 的 task ID，保留任务图像与有序起始页；部署相关站点、账号和数据，并提供完整恢复方案。 | actor 返回原生 STOP 输出后，在浏览器关闭前对最终活动页面运行 VWA evaluator，再封存结果和来源证据。依赖 judge 的任务需冻结、单独核算并通过 judge 控制。 | 700 题是历史设计选样，不是已冻结名单。数据库/文件恢复、图像依赖、认证、judge 路径、任务覆盖和 peer isolation 都需要在目标主机验收。 | [VWA 规格](technical/benchmarks/VWA.md) · [VWA fixture 部署](../code/docs/runbooks/VWA-FIXTURE-DEPLOYMENT.md) |
| **ATA / piñata** | 固定发布的 113 个案例和源步骤标签；执行器只接收公开断言步骤，不得读取 PASS/FAIL 参考标签或失败步骤注释。 | 严格输出 verdict 与 failure_step，并同发布参考比较。FAIL 是正类；二元 verdict 正确性与失败步骤对齐须分开报告。 | 证明源案例身份、应用状态和标签一致；覆盖 PASS/FAIL、before/exact/after、歧义、abstain 和无效输出。当前实现是 reference comparator，不能冒称独立运行时 oracle。Actor 输出形如 {"verdict":"FAIL","failure_step":2}；只有 FAIL 可带正整数源步骤，PASS 与 null verdict 的 failure_step 必须为 null。 | [ATA 规格](technical/benchmarks/ATA.md) · [来源总体清单](../code/config/ata-source-population.v1.json) |

WAV 的 812 和 VWA 的 910 是固定上游源中的任务量；历史选样分别为 600、700。ATA 使用全部 113 个已发布案例（62 PASS、51 FAIL）。任务总体、计划选样和成功运行数是不同统计量。

## 四种执行范式

| 单元 | 执行步骤 | 必须固定的比较条件 | 代码与技术说明 |
|---|---|---|---|
| **视觉 v — AgentLab / BrowserGym** | 对每个 task × round 独立 reset；提供截图和许可交互历史；AgentLab 产生一个动作，经受限 actuator 执行；完成后调用 benchmark 原生 evaluator。 | 禁止 DOM/AX、外部 OCR、selector、URL 控制流和 hidden/evaluator state；记录图像、viewport、动作、请求与真实模型身份。 | [AgentLab](technical/frameworks/AGENTLAB.md) · [BrowserGym](technical/frameworks/BROWSERGYM.md) · [framework_agentlab.py](../code/experiment/framework_agentlab.py) |
| **混合 h — AgentLab / BrowserGym** | 与 v 使用同一任务、模型、决策路径、环境和预算；只增加当前截图中真实可见控件的受限投影。 | 控件投影限于临时 observation ID、role、accessible name、可见值/状态和边界框；禁止原始 HTML、隐藏/离屏字段、CSS/XPath 和稳定内部 ID。 | [输入输出合同](technical/INPUT_OUTPUT.md) · [framework_boundary.py](../code/experiment/framework_boundary.py) |
| **混合框架 u — Restricted Browser Use** | 使用相同 hybrid 信息边界与 native evaluator；PSS 调用 Browser Use 的决策/schema 部件，再由共同 actuator 执行一个动作。 | 禁用默认工具、恢复、规划、直接 URL 打开和隐藏 fallback；done 只是完成提议，不是成功标签。 | [Browser Use](technical/frameworks/BROWSER_USE.md) · [framework_browser_use.py](../code/experiment/framework_browser_use.py) |
| **脚本 s — Playwright** | 准备者在看不到 gold、evaluator 内部和 agent 结果的条件下，基于公开 UI 编写并审核固定脚本；每次机会独立 reset；由相同 benchmark evaluator 评分。 | 运行时不调用 LLM，不得读取私有 API/数据库真值；记录编写、调试、审核劳动和失败准备。共享脚本按每个 benchmark 调度一次。 | [Playwright 基线](technical/frameworks/PLAYWRIGHT.md) · [traditional_actor.py](../code/experiment/traditional_actor.py) |

BrowserGym 是 AgentLab 使用的环境和动作组件，不是第五种实验方法。历史设计的三 benchmark × 四范式矩阵如下；s 对每个 benchmark 共用一份脚本，不按模型重复。当前批次只计划 WAV 行，且尚不可派发。

| Benchmark | 视觉 v | AgentLab 混合 h | Browser Use 混合 u | Playwright 脚本 s | 当前状态 |
|---|---|---|---|---|---|
| [WAV](technical/benchmarks/WAV.md) | 计划 | 计划 | 计划 | 共用基线 | 120 题开发计划；缺少 task/API 绑定与 dispatcher。 |
| [VWA](technical/benchmarks/VWA.md) | 历史设计 | 历史设计 | 历史设计 | 历史设计 | 暂无当前批次；恢复、judge 和主机验收未完成。 |
| [ATA](technical/benchmarks/ATA.md) | 历史设计 | 历史设计 | 历史设计 | 历史设计 | 暂无当前批次；fixture 与标签一致性未验证。 |

这是部分交叉设计：v 与 h 在 AgentLab 内比较输入；h 与 u 在 hybrid 边界内比较框架；s 是共享脚本基线。Browser Use 没有纯视觉单元。

## 四个研究问题如何落到运行记录

1. **RQ1：benchmark-native effectiveness。** 按 WAV template、VWA task 或 ATA verdict/step 原生规则评分；同时报告可评分覆盖率。不要把三个不同结局合成一个跨 benchmark 成功率。
2. **RQ2：固定工作量下的可靠性。** 保留预先选定的所有任务和重复机会。未准备成功及操作失败不能静默删题；真正未知保持 null 并给出界限。准备劳动、运行成本和可用性分开报告。
3. **RQ3：反复错误与同类控制。** D1–D2 用于发现视觉组错误及同 reference class 的正确控制；V1–V10 提供新鲜配对验证。报告 comparator 相对视觉组的增益，以及扣除同类控制增益后的 excess gain。发现组由前两轮结果选出，因此不是因果效应。
4. **RQ4：混合互补性与重试。** 将 V1–V5、V6–V10 作为两个窗口；在同一 retained blocks 上比较两种方法各执行两次的混合策略和各自两次重试。对两个配置 c、d，在同一保留区块的两窗口结果 (c1,c2,d1,d2) 上计算 mixed = (max(c1,d2) + max(c2,d1)) / 2，再与 retry-c = max(c1,c2)、retry-d = max(d1,d2) 比较。此处是离线结果分析，不是在线 router，也不是四次尝试的结果并集。

估计量、分母与缺失规则见[研究设计页](RESEARCH.md)和 v2.1 合同。每个机会对应冻结的 task × configuration × round。网络重试、parser 重试和任务重放均不能计作新的独立机会。

## 从准备到分析：共同流程

1. **选择设计 authority。** 区分当前 WAV 计划与历史 v2.1 合同，冻结 benchmark、任务总体、RQ、实验组、重复次数和数据边界。
2. **冻结输入。** 记录 benchmark commit、官方 task ID、任务/配置/evaluator hashes、真实 API model ID、prompt、框架和浏览器版本、动作/时间/费用上限。任务选取须 outcome-blind；脚本准备者不得接触 gold。
3. **准备隔离环境。** 绑定站点、账号、fixture 版本和有证据的 reset；每个 task × configuration × round 独立恢复。未证明共享 fixture 隔离前不要并发。
4. **分别运行各实验组。** 保持原生 completion 协议；记录开始/终止、失败、usage/cost、setup、reset、finalization 和 missingness。不得让一个方法沿用另一方法修改过的浏览器状态。
5. **执行独立原生评测。** actor 输入与 evaluator reference 分离。保存原始结果、assessment status 和 evaluator source identity；方法失败、运行超时和评测不可用分别编码。
6. **按固定分母分析。** 连接 schedule、receipt 和 evaluator 记录；核对 scheduled/prepared/started/scorable/completed。通过研究分析入口计算 RQ1–RQ4，发布前审查隐私、许可和来源。

## 现在可运行的准备命令

从仓库的 code/ 目录执行：

~~~sh
npm ci
npm run campaign:validate
npm run study:validate
npm run sponsor:verify:portable -- --python python3 --output artifacts/local-runtime/NEW_NAME
~~~

以上是源码与计划检查，不启动 benchmark，也不调用模型。当前 WAV campaign 的 task IDs、provider model IDs 和 dispatcher 尚未就绪；仓库没有可用于执行这批 120 题 GPT 实验的完整启动命令。不要用 Qwen diagnostic runner 或历史 v2.1 schedule 冒充 GPT dispatcher。补齐[范围决策](WAV-ONLY-EXECUTION-SCOPE.md)、本指南列出的绑定和目标主机验收后，需另行冻结本批运行计划。

## 配置与分析入口

- 当前 WAV 开发计划：[current-campaign.json](../code/config/current-campaign.json)
- 历史论文合同指针：[active-study-design.json](../code/config/active-study-design.json)
- benchmark 来源与选样清单：[code/config/](../code/config/)
- 框架候选依赖锁：[code/config/frameworks/](../code/config/frameworks/)；现有锁不等于已验收的 Linux 安装锁
- 规划、输入绑定与导入：[study-pipeline.mjs](../code/analysis/study-pipeline.mjs) · [study-workflow.mjs](../code/analysis/study-workflow.mjs)
- 执行账本与 worker：[runtime_store.py](../code/experiment/runtime_store.py) · [runtime_worker.py](../code/experiment/runtime_worker.py)
- 原生 benchmark evaluator：[code/experiment/](../code/experiment/)
- RQ 汇总分析：[study-analysis.mjs](../code/analysis/study-analysis.mjs)
- 复现层级：[复现指南](REPRODUCIBILITY.md) · [数据公开说明](DATA_AVAILABILITY.md)
