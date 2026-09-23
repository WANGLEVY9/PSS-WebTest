# PSS-WebTest

PSS-WebTest 研究 Computer-Use Agent 与脚本式 Web 测试在重复执行中的可靠性、反复错误和互补性。仓库包含 benchmark 接入、原生结果分析、执行记录和本地检查工具。

[English](README.md) · [当前实验操作指南](docs/EXPERIMENT-OPERATIONS.zh-CN.md) · [代码架构](code/ARCHITECTURE.md) · [研究设计](docs/RESEARCH.md) · [复现指南](docs/REPRODUCIBILITY.md)

## 当前实验

下一批操作范围只有 **WebArena-Verified（WAV）**。计划让 GPT-6 Astra 与 GPT-5.6 Sol 在同一组 120 个任务上运行 AgentLab 纯视觉、AgentLab 混合输入、受限 Browser Use 混合输入，并共用一组 Playwright 脚本基线。一轮计划为 720 次模型执行和 120 次脚本执行，共 **840 次**；2 题、10 题是通往 120 题的开发检查阶段。

这仍是计划，并非已完成实验。任务 ID、实际 API 模型身份、部署绑定和完整批量派发入口尚未固定。[当前实验配置](code/config/current-campaign.json) 明确标记 `dispatcher_available=false`、`confirmatory_authorized=false`。[范围变更记录](docs/WAV-ONLY-EXECUTION-SCOPE.md) 说明了原因；VWA 与 ATA 本批暂停采集。

旧版 `pss-manuscript-v2.1` 合同继续用于历史论文设计和分析。其 **322,164 个计划执行机会**属于三 benchmark 设计，不是本次 WAV 实验规模，也不是已完成运行量。解释旧合同时参照[研究设计](docs/RESEARCH.md)，不能用它派发当前实验。

## 代码与检查

[架构说明](code/ARCHITECTURE.md) 标出配置、运行、框架适配、评测、分析与本地观测的入口。当前 benchmark 实现主要位于 `code/experiment/`；旧本地应用实验的实现与专用测试保存在被 Git 忽略的 `temp/`。旧记录、状态报告与退役配置保存在被 Git 忽略的 `temp/`。

安装 Node.js 20+、Python 3 和 Playwright Chromium 后，可运行无模型调用的源码检查：

```sh
cd code
npm ci
npx playwright install chromium
npm run campaign:validate
npm run study:validate
mkdir -p artifacts/local-runtime
npm run sponsor:verify:portable -- --python python3 --output artifacts/local-runtime/offline-001
```

每次验证都要使用新输出目录。`study:validate` 检查旧论文合同；`campaign:validate` 检查当前 WAV 计划。两者均不授权采集，也不代表已执行官方任务。不同复现层级和待验收事项见[复现指南](docs/REPRODUCIBILITY.md)。

发布前在仓库根目录运行 `node scripts/check-docs.mjs` 和 `./scripts/check-public-boundary.sh`。公开边界脚本检查 Git 索引；此前已公开的历史记录不会因本次移除索引而自动消失。

## 数据与引用

私有论文、原始运行记录、凭据、内部 mock 讨论数据和本地归档不属于公开仓库。[数据公开说明](docs/DATA_AVAILABILITY.md) 记录发布状态。公开论文、DOI 与逐执行复现包仍待发布；合成 fixture 和离线检查不是实测研究结果。

引用软件请使用 [CITATION.cff](CITATION.cff) 并记录准确 commit。项目自身代码与文档使用 [MIT License](LICENSE)，第三方 benchmark、框架和应用遵循各自许可。[参与贡献](CONTRIBUTING.md) · [安全报告](SECURITY.md)
