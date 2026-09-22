# Qwen3.8-Max 本地实测与门禁复核 — 2026-09-22

## 结论与证据范围

已使用真实 Aliyun API 和 `qwen3.8-max` 完成 50 次请求尝试：49 次 HTTP 200，
1 次请求超时；49 次有效响应返回的模型 ID 均为 `qwen3.8-max`。这是模型别名，
不是固定快照。模型的视觉输入能力参见[官方文档](https://help.aliyun.com/zh/model-studio/qwen3-8-max)。

本轮运行 17 次多步**合成控制任务**（真实浏览器、框架和模型调用），14 次完成，
3 次失败。另有 2 次独立截图 API 冒烟请求。**本轮新增官方 benchmark 任务执行为 0，
没有 confirmatory 数据**，不能把这些控制任务计入 WAV/VWA/ATA 分母。

任务覆盖图片上传、弹出第二页面、读取可见确认码、终止后的独立验证，以及
请求记账、逐步截图、轨迹和统一生命周期封存。它不代表复杂官方任务的成功率。

## 分配置结果（不跨变体合并估计）

| 运行组 | 坐标 / 输出上限 | 完成 | 失败情况 |
|---|---|---:|---|
| 早期框架 smoke：AgentLab visual、AgentLab hybrid、Browser Use hybrid | normalized / 1024 | 各 1/1 | 无；尚非完整生命周期封存路径 |
| 封存路径：AgentLab Pure visual | normalized / 1024 | 3/3 | 无 |
| 封存路径：AgentLab Hybrid | normalized / 1024 | 0/1 | HTTP 200，但 `finish_reason=length`，输出截断 |
| Token 单因素诊断：AgentLab Hybrid | normalized / 2048 | 1/2 | 一次 30 秒 provider timeout |
| 坐标单因素诊断：AgentLab Hybrid | CSS / 1024 | 2/2 | 无 |
| 封存路径：Browser Use Hybrid | normalized / 1024 | 0/1 | 上传坐标反复偏离，10 次动作预算耗尽 |
| 坐标单因素诊断：Browser Use Hybrid | CSS / 1024 | 2/2 | 无 |
| 封存路径：Traditional Playwright | 不使用模型 | 3/3 | 无 |

全部 17 份轨迹通过独立重新读取的完整性审计；其中 14 份新生命周期 envelope
通过封存校验。所有已记录 ledger 均无 reservation overrun。使用量已报告部分为
156,742 input tokens + 6,439 output tokens = 163,181 tokens；含 88,064 cached input
tokens（已包含在 input 中，不重复累加）。超时请求无有效 usage，实际费用未知。

## 失败定位和可支持的判断

1. **API smoke 的 visual JSON 形状不匹配**：返回单元素数组，协议要求对象。
   私有原始响应人工核对发现图像内容识别正确，但自动合同检查仍保留失败。
   没有自动拆包、改写输出或抹去失败。不能据此断言模型没有图像理解能力。
2. **AgentLab Hybrid 输出截断**：1024 token 请求达到上限并返回 `length`。
   仅提高到 2048 后并未稳定消除问题，还出现一次请求超时。可能涉及生成长度、
   请求延迟和接口协议适配；现有样本不足以判断超时来自服务端排队还是网络。
3. **Browser Use Hybrid 坐标 grounding 敏感性**：失败轨迹连续上传点击输出
   normalized `(109, 363)`，执行器按协议一次转换为 CSS `(109, 254.1)`。
   1000×700 原始截图中上传按钮位于约 x=40–163、y=168–196，因此确实点偏。
   不是代码已被证明重复转换；模型可能混用了工具通用 CSS 描述与归一化协议。
   只改为 CSS 后两次成功，支持继续检验坐标接口敏感性，不能据此断言已找到
   唯一根因、已修复所有模型，或 Hybrid 优于/劣于其他臂。

这些变体为观察失败后的探索性诊断，未偷偷替换冻结配置。没有增加 gold、
隐藏状态或 oracle 反馈；所有失败保留为独立执行。多个控制并发运行过，
因此不能将记录延迟作为公平的策略速度比较。

## 回归与官方环境检查

- 完整离线验证 `verification-010`：578 项测试通过，0 skipped；包括真实安装
  的框架探针和 Chromium 动作/生命周期控制。482 个源文件在验证期间无漂移。
  四组需要历史数据的检查不在本轮执行范围内，不能算作通过。
- 官方输入预检成功导出 WAV task 163，并验证其 19 配置 × 12 轮调度结构；
  228 项只是待执行机会，不是实验结果，尚无完整 runtime binding。
- 部署检查仍阻塞：VWA 依赖一致性；WAV/VWA 环境固定证据和 Docker VM 存储
  证据；现有 WAV shopping 容器暴露非 loopback 端口、无声明健康检查；真实
  逐臂 reset / 跨实例隔离 / 原生 evaluator 准入证据仍不足。
- 360 次 development 验收计划仍为 0 received、0 evidence-ready、0/12 fixture-ready。
  没有用本轮合成记录填充该分母，也没有修改在运行的旧应用实例。

## 下一步

先解决官方部署与逐臂环境门禁，再用 outcome-blind 的官方任务小样本验证
各执行器完整链路。坐标/输出预算需要在独立 development 样本中确定后显式冻结；
不要因为这几次控制任务成功就恢复大批量采集。Qwen 已足以继续工程连通性
诊断，目前没有凭据错误或普遍缺乏图像输入支持的证据，但服务稳定性仍待验证。

逐条运行 ID、配置、失败分类、报告哈希和轨迹哈希见同名 JSON。
可复跑步骤见 `code/local-lab/QWEN-LIVE-DIAGNOSTICS.md`。
原始截图、请求/响应、trace、HAR 和私有 ledger 保存在被忽略的本地 artifacts，
不上传公开仓库；本次公开报告仅包含脱敏元数据。
