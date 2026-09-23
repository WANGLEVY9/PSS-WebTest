# PSS-WebTest

PSS-WebTest 是一项关于 Computer-Use Agent 与脚本式 Web 测试的实证研究，关注 benchmark 原生任务表现、重复执行可靠性、反复错误，以及组合不同方法是否优于分别重试。

[English](README.md) · [实验地图与操作速查](docs/EXPERIMENTS.zh-CN.md) · [代码架构](code/ARCHITECTURE.md) · [研究设计](docs/RESEARCH.md) · [复现指南](docs/REPRODUCIBILITY.md)

## 研究范围

研究材料覆盖三个 benchmark 和四种执行范式。任务是否成功由对应 benchmark 的原生评测定义；框架自身的 reward 或脚本断言不能替代它。

| Benchmark | 任务总体与研究选样 | 原生评测 | 当前状态 |
|---|---|---|---|
| [WebArena-Verified（WAV）](docs/technical/benchmarks/WAV.md) | 官方源包含 812 个任务；历史论文设计选取 600 个。另有一批独立的当前开发计划，目标为 120 个预先冻结的 task ID。 | 保留原始结构化完成输出和网络轨迹，由固定版本 WAV evaluator 评分。 | 当前批次只规划 WAV 开发实验。task ID、API 模型身份尚未绑定；派发器、运行授权均为 false。 |
| [VisualWebArena（VWA）](docs/technical/benchmarks/VWA.md) | 官方源包含 910 个任务；历史论文设计选取 700 个。 | 在任务结束后的最终活动页面运行原生评测；依赖 judge 的路径须先冻结并审计策略。 | 历史论文设计和代码参考；环境恢复、judge 和主机验收尚未完成。 |
| [ATA / piñata](docs/technical/benchmarks/ATA.md) | 官方发布的 113 个案例：62 PASS、51 FAIL；历史设计使用完整总体。 | 预测 verdict 与 failure step，并和已发布参考比较；要解释为实际运行正确性，还须独立证明现场 fixture 与标签一致。 | 历史设计和分析参考；运行环境与标签一致性尚未验证。 |

历史合同 pss-manuscript-v2.1 的分母是 1,413 个任务 × 19 种配置 × 12 轮，共 **322,164 个计划执行机会**。这是设计规模，不是已完成或已导入的运行数，也不能拿来派发当前 WAV 批次。

## 四种执行范式

| 单元 | 框架与输入 | 比较方式 |
|---|---|---|
| 视觉（v） | [AgentLab](docs/technical/frameworks/AGENTLAB.md) 与 [BrowserGym](docs/technical/frameworks/BROWSERGYM.md)；只接收截图和许可的交互状态 | 与同一框架的混合输入单元比较。不给 DOM、无障碍树、外部 OCR、selector 或评测器状态。 |
| 混合输入（h） | [AgentLab](docs/technical/frameworks/AGENTLAB.md) / [BrowserGym](docs/technical/frameworks/BROWSERGYM.md)；截图加受限的可见控件投影 | 仅增加观测内临时 ID、角色、可访问名称、可见值/状态和裁剪后的边界框；不提供原始 HTML 或隐藏状态。 |
| 混合框架比较（u） | [受限版 Browser Use](docs/technical/frameworks/BROWSER_USE.md)；使用相同声明的信息边界 | 比较两个框架集成，但 Browser Use 没有纯视觉单元，因此是部分框架/输入交叉，不是完整析因设计。 |
| 脚本基线（s） | [Playwright 审核后的固定脚本](docs/technical/frameworks/PLAYWRIGHT.md)；盲化准备阶段可用公开 UI/DOM/AX，执行时不调用 LLM | 一份脚本基线由所有模型比较共享。记录编写、调试与审核成本；作者不能看 evaluator 内部、标准答案或 agent 轨迹。 |

AgentLab 使用 BrowserGym 组件；BrowserGym 不是额外的实验组。历史论文设计覆盖三个 benchmark × 四种执行范式；当前 WAV 开发计划只覆盖 WAV 的四个单元。每个 benchmark 都使用自己的原生 evaluator；VWA 和 ATA 的四个单元仍受目标环境验收门槛约束。各 benchmark × 范式的步骤、代码入口和准备条件见[实验地图](docs/EXPERIMENTS.zh-CN.md)。

## 当前可以开展的准备

当前实验是一个**120 题 WAV 开发计划**：GPT-6 Astra 与 GPT-5.6 Sol 两个展示标签，三种 agent 单元（v、h、u）以及共用的 Playwright 基线，计划为 720 次模型执行加 120 次脚本执行。2、10、120 题是开发检查阶段，不是已完成运行数。

准确 task ID、API 模型身份、部署绑定和完整派发器均未就绪。[机器可读实验计划](code/config/current-campaign.json)明确设置 <code>dispatcher_available=false</code>、<code>new_execution_authorized=false</code>、<code>confirmatory_authorized=false</code>。[WAV 操作指南](docs/EXPERIMENT-OPERATIONS.zh-CN.md)说明了环境与配置交接，但不能替代派发器，也不构成采集授权。

源码检查从 code/ 目录开始，运行以下命令核对计划与代码合同。它们不调用模型，也不执行官方任务。

~~~sh
cd code
npm ci
npm run campaign:validate
npm run study:validate
npm run sponsor:verify:portable -- --python python3 --output artifacts/local-runtime/NEW_NAME
~~~

## 研究设计与证据

[研究设计](docs/RESEARCH.md)定义 RQ1–RQ4、估计量、分母和缺失数据处理；[实验地图](docs/EXPERIMENTS.zh-CN.md)按 benchmark 与执行范式链接技术规格、代码入口、准备步骤和验收门槛；[数据公开说明](docs/DATA_AVAILABILITY.md)说明当前公开材料的边界。

合成 fixture、注入式框架响应、源码检查和本地诊断属于工程证据，不是 benchmark 实验结果。分别保留计划、已准备、已启动、可评分和已完成数量。

引用软件请使用 [CITATION.cff](CITATION.cff)，并记录准确 commit。项目自身代码与文档采用 [MIT License](LICENSE)；第三方 benchmark、框架和应用仍遵循各自许可。
