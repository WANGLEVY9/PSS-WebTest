# PSS-WebTest

PSS-WebTest 是一项关于 Computer-Use Agent 与脚本式 Web 测试的实证研究，比较 agent 在原生网页任务上的成功表现与重复可靠性，并考察视觉/混合输入、框架实现及 Playwright 脚本基线之间的差异。

[English](README.md) · [实验地图与操作速查](docs/EXPERIMENTS.zh-CN.md) · [代码架构](code/ARCHITECTURE.md) · [研究设计](docs/RESEARCH.md) · [复现指南](docs/REPRODUCIBILITY.md)

## Benchmark 与研究样本

| Benchmark | 研究样本 | 原生任务评测 |
|---|---:|---|
| [WebArena-Verified（WAV）](docs/technical/benchmarks/WAV.md) | 600 个任务 | 保存结构化完成输出与网络轨迹，使用固定版本 WAV evaluator 评分。 |
| [VisualWebArena（VWA）](docs/technical/benchmarks/VWA.md) | 700 个任务 | 在最终活动页面运行 VWA task evaluator；需要 judge 的任务按预先声明的 judge 策略评测。 |
| [ATA / piñata](docs/technical/benchmarks/ATA.md) | 113 个案例：62 PASS、51 FAIL | 将 verdict 与 failure step 同发布参考比较；分别报告 verdict 正确性和步骤对齐。 |

研究矩阵包含六个模型身份、每个模型的三个 agent 单元，以及一个由模型间共用的 Playwright 脚本单元，共 19 种配置。每个 task/configuration 有两轮发现阶段（D1–D2）和十轮验证阶段（V1–V10）。计划执行机会按 benchmark × task × configuration × round 定义。

## 执行范式

| 单元 | 框架与输入 | 实验作用 |
|---|---|---|
| 视觉（v） | [AgentLab](docs/technical/frameworks/AGENTLAB.md) 与 [BrowserGym](docs/technical/frameworks/BROWSERGYM.md)；截图和许可的交互状态 | 测量纯截图交互，不提供 DOM、无障碍树、外部 OCR、selector 或评测器状态。 |
| 混合输入（h） | AgentLab / BrowserGym；截图加受限的可见控件投影 | 只增加当前观测中可见的控件；与 v 在相同任务、模型、环境和预算下比较。 |
| 混合框架（u） | [受限版 Browser Use](docs/technical/frameworks/BROWSER_USE.md)；相同混合输入边界 | 在匹配的 hybrid 输入下比较框架决策。Browser Use 没有纯视觉单元，因此框架/输入交叉不完整。 |
| 脚本基线（s） | [Playwright](docs/technical/frameworks/PLAYWRIGHT.md)；审核后的公开 UI 脚本，执行时不调用 LLM | 每个 benchmark 使用一份模型间共享的脚本基线。准备者不能查看 evaluator 内部、参考标签或 agent 结果。 |

各 benchmark × 执行范式的实验步骤、输入合同、reset/评测顺序、研究问题及代码入口见[实验地图](docs/EXPERIMENTS.zh-CN.md)。

## 研究执行

每个 benchmark 在运行前冻结官方 task ID、源代码和 evaluator 版本、模型/API 身份、prompt、浏览器与框架版本、预算、环境绑定及分析计划。每次 benchmark/configuration/round 独立 reset，按预先声明的方法执行，保存原始完成输出和轨迹，再调用 benchmark 原生 evaluator。准备失败、操作失败、未知结果与成功评分都保留在固定分析分母中并分别标记。

[研究设计](docs/RESEARCH.md)定义 RQ1–RQ4 及对应估计量；[复现指南](docs/REPRODUCIBILITY.md)说明环境准备和证据收集；[数据公开说明](docs/DATA_AVAILABILITY.md)说明公开材料边界。

从 code/ 目录初始化源码环境并检查研究合同：

~~~sh
npm ci
npm run study:validate
npm run campaign:validate
npm run sponsor:verify:portable -- --python python3 --output artifacts/local-runtime/NEW_NAME
~~~

这些命令核对源码与配置合同，不调用模型，也不执行 benchmark 任务。引用软件请使用 [CITATION.cff](CITATION.cff) 并记录准确 commit。项目自身代码与文档使用 [MIT License](LICENSE)；第三方 benchmark、框架和应用遵循各自许可。
