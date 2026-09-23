# 实验设计与操作地图

[项目首页](../README.zh-CN.md) · [English](EXPERIMENTS.md) · [研究设计与 RQ](RESEARCH.md) · [技术文档索引](technical/README.md)

本页按 benchmark 和执行范式说明实验输入、运行步骤、原生评测、配置与分析入口。每项实验都遵循同一规则：固定官方任务和环境，独立 reset，严格限制 actor 可见信息，保留原始执行证据，由对应 benchmark evaluator 判定结果。

## 研究设计一览

研究样本包含 WAV 600 个任务、VWA 700 个任务、ATA 113 个案例（62 PASS、51 FAIL）。每项任务运行六个模型身份下的三个 agent 单元：AgentLab 视觉 v、AgentLab 混合 h、受限 Browser Use 混合 u；另有一个共享 Playwright 脚本单元 s。因此每个 benchmark 有 19 种配置。每个任务/配置安排两轮发现（D1–D2）和十轮验证（V1–V10）；计划机会按 benchmark × task × configuration × round 计算。

| Benchmark | v：AgentLab 视觉 | h：AgentLab 混合 | u：Browser Use 混合 | s：Playwright 脚本 | 样本 |
|---|---|---|---|---|---:|
| [WAV](technical/benchmarks/WAV.md) | 截图 | 截图 + 可见控件 | 截图 + 可见控件 | 共享脚本 | 600 任务 |
| [VWA](technical/benchmarks/VWA.md) | 截图 | 截图 + 可见控件 | 截图 + 可见控件 | 共享脚本 | 700 任务 |
| [ATA / piñata](technical/benchmarks/ATA.md) | 截图 | 截图 + 可见控件 | 截图 + 可见控件 | 共享脚本 | 113 案例 |

脚本单元对每个 benchmark 只准备、调度一份，并由六个模型比较共享；不能按模型复制成独立观测。

## Benchmark 实验步骤

### WAV — WebArena-Verified

1. 固定 WebArena-Verified 源版本和官方 task ID；保留模板、任务输入、声明站点及所有有序起始 URL。
2. 将 actor 公共输入与可信 setup、私有 evaluator reference 分开。按所选任务部署所需站点，为每次机会绑定账号、起始页和环境基线。
3. 对每个 task × configuration × round 独立 reset；执行 v、h、u 或 s 中的一种方法。
4. 保存原始 FinalAgentResponse 和完整 HAR。关闭浏览器后将任务、原始输出和 HAR 交给固定版本 WAV evaluator。
5. 分别记录 native score、可评分状态、actor 终止原因、reset/执行/收尾耗时和操作正确性。

**评测要点：** WAV 的网络轨迹属于评测证据，不进入 actor 后续观察；actor 超时不能被之后的成功评测覆盖。只报告所选任务及其覆盖情况，不将其外推为官方全量排行榜成绩。

资料：[WAV 原生规格](technical/benchmarks/WAV.md) · [云端部署与验收](../code/experiment/cloud-handoff/README.md) · [运行生命周期](../code/docs/runbooks/LIFECYCLE-AND-NATIVE-EVALUATION.md)

### VWA — VisualWebArena

1. 固定源版本和带站点命名空间的 task ID；保存原始任务图像、任务配置与有序起始页。
2. 按选中任务闭包部署 Classifieds、Shopping、Reddit、Wikipedia 或 Homepage 等环境，固定账号、图片依赖和完整数据恢复方式。
3. 每个 task × configuration × round 恢复独立环境，运行对应 agent 或共享 Playwright 脚本。
4. agent 产生原生 STOP 输出后，在浏览器关闭前对最终活动页面运行 VWA evaluator，再封存页面、评测与来源证据。
5. 按任务类型记录确定性 evaluator 和 judge-dependent evaluator；judge 的模型、prompt、成本和正负控制作为评测配置保存。

**评测要点：** 必须在最终活动页面运行 evaluator；新建页面或重放任务不等价。需要 judge 的任务应使用冻结配置，分别报告 judge 覆盖率和其他评测覆盖率。

资料：[VWA 原生规格](technical/benchmarks/VWA.md) · [fixture 部署流程](../code/docs/runbooks/VWA-FIXTURE-DEPLOYMENT.md)

### ATA / piñata

1. 固定发布版本、113 个官方案例、源步骤标签和 CSV/ZIP 哈希；不平衡 PASS/FAIL 类别，不重编号步骤。
2. 向 actor 提供原始公开断言步骤；将 verdict、failure-step 参考及失败注释保存在 actor 不可访问的评测输入中。
3. 每个 task × configuration × round 恢复独立 fixture；执行器按统一 schema 输出预测。
4. 输出格式为 JSON，例如 {"verdict":"FAIL","failure_step":2}。PASS、FAIL、null 为允许 verdict；只有 FAIL 可以携带正整数源步骤，其他情况 failure_step 为 null。
5. 与发布参考逐项比较；分别计算 verdict coverage、accuracy、sensitivity、specificity，以及真阳性中的 failure-step 对齐。

**评测要点：** FAIL 为正类。reference comparison 只证明与发布标签一致；要报告实际运行正确性，还需证明现场应用状态、fixture 和标签独立一致。null 是 abstention，不能自动记为 FAIL。

资料：[ATA 原生规格](technical/benchmarks/ATA.md) · [官方来源总体清单](../code/config/ata-source-population.v1.json)

## 四种执行范式如何配置

| 单元 | actor 输入 | 运行方式 | 必须排除的信息 | 入口 |
|---|---|---|---|---|
| **v — AgentLab 视觉** | 当前截图、公开任务/图片、已接受动作历史、通用动作错误、剩余预算 | AgentLab GenericAgent 产出一个动作；PSS validator 检查并由 journaled actuator 执行 | DOM/AX、OCR、selector、URL 控制流、隐藏页面状态和 evaluator state | [AgentLab](technical/frameworks/AGENTLAB.md) · [BrowserGym](technical/frameworks/BROWSERGYM.md) · [framework_agentlab.py](../code/experiment/framework_agentlab.py) |
| **h — AgentLab 混合** | v 的全部输入，另加当前画面可见控件的投影 | 与 v 共用模型、任务、reset、动作边界和预算 | 原始 HTML、隐藏/离屏文字、稳定应用 ID、CSS/XPath、私有 API | [信息输入合同](technical/INPUT_OUTPUT.md) · [framework_boundary.py](../code/experiment/framework_boundary.py) |
| **u — Browser Use 混合** | 与 h 相同的截图和受限可见控件 | 调用 Browser Use 决策/schema 部件，经同一 PSS actuator 执行单个动作 | 默认工具/恢复/规划、直接 URL 打开、隐藏 fallback、任意多动作输出 | [Browser Use](technical/frameworks/BROWSER_USE.md) · [framework_browser_use.py](../code/experiment/framework_browser_use.py) |
| **s — Playwright 脚本** | 准备阶段可访问公开 UI/DOM/AX；执行时只运行冻结脚本 | 对每个 benchmark/task 独立 reset，运行审核脚本，再交给同一原生 evaluator | evaluator 实现、gold、私有 API/数据库真值、agent 轨迹；运行时 LLM | [Playwright](technical/frameworks/PLAYWRIGHT.md) · [traditional_actor.py](../code/experiment/traditional_actor.py) |

AgentLab 使用 BrowserGym 的动作与环境组件，BrowserGym 不是额外实验组。v 与 h 检验同一框架下的信息输入差异；h 与 u 比较相同 hybrid 信息边界下的框架实现；s 提供传统脚本参照。Browser Use 没有视觉单元，因此实验不是完整的框架 × 输入析因设计。

**匹配项：** task ID、模型及 API 返回身份、prompt、框架/浏览器版本、viewport、locale、时区、动作数/时限/费用上限、站点数据、reset 状态、输出 schema 和 evaluator 版本。脚本准备需对 agent 结果和评测参考保持盲化；准备、调试、审核工作量都进入记录。

## 研究问题与分析入口

1. **RQ1：原生任务效果。** WAV 按 task template macro 汇总，VWA 按 task 汇总，ATA 以 FAIL 为正类并报告 verdict 与步骤评测。跨 benchmark 不合并不同原生终点。
2. **RQ2：重复运行可靠性。** 在固定样本和重复次数上统计任务级结果、准备率、执行成本和 coverage；准备失败/操作失败留在分母，无法确定的结果保持 null 并报告识别界限。
3. **RQ3：反复错误与同类控制。** D1–D2 选出视觉单元错误和同 reference class 的正确控制，V1–V10 做新配对评估；报告 comparator 相对视觉单元的提升及扣除同类控制增益后的差值。
4. **RQ4：方法互补与重试。** 将 V1–V5、V6–V10 作为两个窗口，在相同 eligible blocks 上比较两方法混合策略和各自重试。对配置 c、d 的两窗口结果 (c1,c2,d1,d2)，mixed = (max(c1,d2) + max(c2,d1)) / 2；分别与 retry-c = max(c1,c2)、retry-d = max(d1,d2) 比较。这是离线 outcome 分析，不是在线 router。

计划表和输入绑定由 [study-pipeline.mjs](../code/analysis/study-pipeline.mjs) 与 [study-workflow.mjs](../code/analysis/study-workflow.mjs) 管理；执行账本与 worker 位于 [runtime_store.py](../code/experiment/runtime_store.py) 和 [runtime_worker.py](../code/experiment/runtime_worker.py)；汇总分析见 [study-analysis.mjs](../code/analysis/study-analysis.mjs)。

## 初始化和合同检查

从 code/ 目录安装项目依赖并检查配置：

~~~sh
npm ci
npm run study:validate
npm run sponsor:verify:portable -- --python python3 --output artifacts/local-runtime/NEW_NAME
~~~

validator 用于检查源码、研究合同和离线运行不变量；实测执行应遵循上述任务绑定、环境恢复、隔离运行、原生评测和证据封存步骤。各 benchmark 专属配置位于 code/config/ 与 code/config/frameworks/，每次运行使用独立 schedule、runtime bindings 和输出目录。

更细的缺失数据、估计量及证据规则见[研究设计](RESEARCH.md)与[复现指南](REPRODUCIBILITY.md)；目录与依赖边界见[架构说明](../code/ARCHITECTURE.md)。
