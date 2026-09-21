# 赞助商接入前的工程审计与交付状态

结论：**GPT 的接入代码和独立配置入口已补齐；完整三 benchmark 实验平台尚未达到“只填 API 就能开始正式实验”的标准。** 本次没有调用真实 GPT、没有新增 benchmark 实验结果，也没有修改历史结果或放开准入开关。

## 已实测完成

- OpenAI Responses 和 Chat Completions 两种显式接口已接入现有 Visual/Hybrid runner；保留阿里分支，不静默切换 API、模型或厂商。
- GPT 使用独立 `OPENAI_*` 配置，不继承 Qwen 的 key/model/base。API key 不可被配置对象 JSON 序列化；请求禁止自动重定向，错误日志不回显 provider 错误正文。
- GPT 接口正确区分正常动作、拒绝、截断、格式错误、鉴权、限流、服务、网络和超时。原始失败仍保留，不补动作、不补答案、不提高失败臂预算。
- 新增独立空白 `code/.env.openai`，权限 600、Git 已忽略，尚未填入赞助商 key/model；未改写原有 Qwen 配置。
- 新增 `sponsor:verify`、`sponsor:preflight`、`sponsor:smoke`、`sponsor:console` 四个入口。默认 smoke 不联网；显式 `--live` 最多发送两次生成的合成图像，不读取 benchmark 答案。
- 完整回归：59/59 本地及浏览器测试、287/287 研究契约测试、3/3 ATA 准备测试通过；设计、artifact manifest 和长周期计划校验通过。
- 新增真实服务进程测试：假 GPT 配置能出现在控制台中，key 不泄漏；即使 opt-in 为 1，缺失 reset 的启动请求仍返回 409，未创建实验。
- 修复就绪探针：使用 benchmark 规范地址 `localhost:7770`，等待全部服务后执行一次、读取正文的 90 秒预热请求。旧的 `127.0.0.1` 请求返回正常 canonical 302，不应误判为站点故障；新探针实测 HTTP 200、正文 164,391 字节、416 ms（已热主实例）。这不等同于 fresh reset 或任务可执行证明。
- 历史账本仍为 5 个批次、33 条记录、7 个已暴露开发任务；校验无错。v7 为新诊断协议，不与旧版本合并统计。

## 真实阻碍及优先顺序

| 优先级 | 缺口 | 完成标准 | 负责边界 |
|---|---|---|---|
| P0 | WAV reset 仅六表三轮独立证明，未进入 runner | 每个 arm/repetition 实际 reset；任务依赖闭包指纹；失败时禁止进入下一 cell；隔离及清理证据 | 项目工程 |
| P0 | WAV 仍只有只读 Shopping retrieval 适配 | 原任务、start URL、权限、动作/答复、HAR 与官方 evaluator 全链验证；错误判定不依赖竞争臂结果 | 项目工程与方法审查 |
| P0 | VWA 尚无完整部署/三臂 adapter | VM 容量、官方资产、登录、reset、任务图片、VQA/evaluator、replay 全部通过 | 项目工程；资源若不足再请求支持 |
| P0 | ATA 官方标签与本地 fixture 等价性未建立 | 113 parser 候选与112冻结计数修订、fixture复现、reset、规格/gold隔离、共享评估验证 | 工程 + 明确设计确认 |
| P0 | 正式任务和 Traditional 台账为空 | 两位独立 reviewer 审查/裁决；先冻结纳入/排除集；盲写与语义复核脚本；部署失败保留分母 | 人工研究流程，不能自动签字 |
| P1 | 原始 Shopping 暴露端口为 wildcard | 专用实例绑定 loopback 或验证网络隔离；不公开 env-controller/fixture账号 | 项目工程；本轮未重建主实例 |
| P1 | GPT 真实连通/限额未验证 | sponsor 提供 key/model 后合成图像 smoke 与预注册 soak；不按任务成功率挑模型 | sponsor供给，项目测试 |
| P1 | 批量 scheduler 不完整 | 预生成调度、独立分片租约、逐臂重置、幂等记录、崩溃恢复、并发/费用停止测试 | 项目工程 |
| P1 | 正式统计冻结尚未完成 | pilot变异→repetition/power→分析冻结→明确授权，不以达到3000条代替power | 研究方法 |

## torch 警告的进一步归因

本地 VWA Python 3.11 / torch 2.0.1 的 `libtorch_cpu.dylib` 是 ARM64，而 `WHEEL` 标签是 `cp311-cp311-macosx_11_0_x86_64`。进一步从 [PyPI 官方 torch 2.0.1 元数据](https://pypi.org/pypi/torch/2.0.1/json) 找到 `torch-2.0.1-cp311-none-macosx_11_0_arm64.whl`，通过 HTTP Range 读取该官方包的 ZIP 目录和 WHEEL entry。其内部标签同样是 x86_64，且 WHEEL 字节与本地完全一致。

- WHEEL SHA-256：`9c45b24b2f745787b7aaa6986e515cd86298c58075ea12426687f0fb634a9174`。
- 官方 wheel 声明大小 55,831,241 字节，声明 SHA-256 `25aa43ca80dcdf32f13da04c503ec7afdf8e77e3a0183dd85cd3e53b2842e527`。
- 完整下载在120秒后超时，**没有完成整个 wheel 的 checksum 验证**；只核对了官方发布地址中的元数据片段。读取区间：55,765,705–55,831,240（ZIP尾目录）和54,459,335–54,459,846（目标entry）；WHEEL压缩数据106字节。
- 因此有直接证据支持这是官方 ARM64 发行包自带的元数据不一致，不能据此声称我们安装的是 x86 运行库。`uv pip check` 警告仍保留；未改元数据、未升级固定版本。完整VQA/BLIP推理仍未验证，不能借此放行VWA。

## 交付入口与科研边界

给赞助商的可执行步骤、配置项和完整验收顺序见 [SPONSOR-HANDOFF.md](SPONSOR-HANDOFF.md)。当前接入的是“GPT作为VLM的PSS agent”，不是OpenAI原生computer-use工具，也不是AgentLab或Browser Use复现。

正式实验遵循确认过的三benchmark组合及分层设计；本地五应用不回填正式分母。配置无误、单元测试通过、API连通、环境准入、任务准入和confirmatory授权必须分别报告。**本轮验收结果是接入层工程完成，不是整个研究平台已交付。**
