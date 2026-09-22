# 实验人员操作单：只运行 WebArena-Verified

更新：2026-09-22。**本批次只做 WebArena-Verified（WAV）；不安装、不运行 VisualWebArena（VWA）和 ATA。** 历史代码与数据保留，不纳入本批次分母。范围决定见[本次范围变更记录](docs/WAV-ONLY-EXECUTION-SCOPE.md)。

## 先看这一页：到底跑哪几步？

**顺序就是：装代码 → 准备 WAV 任务 → 离线检查 → 验收 WAV 环境 → 小批 GPT 联调 → 扩量与交回。**

| 步骤 | 谁做、做什么 | 完成标准 | 现在能否做 |
| --- | --- | --- | --- |
| 1 | 实验人员：获取固定发行代码、安装基础依赖、填写 API 配置 | 版本可追溯，密钥只在私有文件 | 可以 |
| 2 | 实验人员：获取固定 WAV 源码、生成官方任务输入 | 812 条源任务有清单；不等于全部可执行 | 可以，不调用模型 |
| 3 | 实验人员：运行离线检查 | 报告无失败，未运行项单列 | 可以，不调用模型、不启动 benchmark |
| 4 | 项目组交付环境包，双方验收：部署选定任务的站点、reset、认证、隔离与原生评分 | 对本次任务和配置的真实收据齐全 | 待目标主机验收；不是只看 Docker 启动成功 |
| 5 | 项目组交付 GPT 执行入口，实验人员运行：2 → 10 → 20 个共同任务 | 每个任务四个配置都完成链路，模型答错也可形成有效记录 | GPT 批量入口尚未完成交付；不要自行拼命令 |
| 6 | 双方审核后：扩到 100 个共同任务，导出全部证据 | 每配置 100 个不同任务，计划共 400 次执行；失败不删 | 步骤 4、5 通过后再批准 |

**给实验人员的当前动作：先完成步骤 1–3，把离线报告交回。步骤 4–5 的缺失软件与配置由项目组补齐，不要求你自行开发，也不要直接付费批跑。**

现状：本地已有 WAV 官方任务 `260、261、274` 的诊断执行记录；不是 100 项验收通过，也不是 GPT 已跑通。现有 `wav_official_acceptance_probe.py` 固定 Qwen，只支持这三个 ID，**更换 GPT key 不会把它变成 GPT 入口**。

## 1. 获取代码、安装基础依赖、填写 API 配置

使用独立 Linux x86_64 主机。管理员先安装 Git、Node ≥20、Python ≥3.11、Docker Engine / Compose v2，并将 `/srv/pss` 授权给实验账号。框架和原生 evaluator 的独立 Python 环境在步骤 4 安装，不混装到系统 Python。

以下代码块在 Bash 中运行，使用子 shell 失败即停。首次安装运行；已有目录或输出文件时先核对，不覆盖旧证据。下一步必须人工核对上一步结果，不能把整篇一次粘贴执行。

```bash
(
set -euo pipefail
mkdir -p /srv/pss/private /srv/pss/runs
chmod 700 /srv/pss/private /srv/pss/runs
git clone https://github.com/WANGLEVY9/PSS-WebTest.git /srv/pss/repo
cd /srv/pss/repo
read -r -p '项目组交接单中的完整 release commit: ' PSS_RELEASE_COMMIT
git checkout --detach "$PSS_RELEASE_COMMIT"
test "$(git rev-parse HEAD)" = "$PSS_RELEASE_COMMIT"
git rev-parse HEAD
git status --short
cd code
umask 077
npm ci
npx playwright install --with-deps chromium
mkdir -p artifacts/benchmark-snapshots artifacts/local-runtime
test ! -e /srv/pss/private/provider.env && \
  install -m 600 local-lab/openai.env.example /srv/pss/private/provider.env
)
```

用本机编辑器填写 `provider.env` 中的 `OPENAI_API_KEY`、资源方提供的准确 `OPENAI_MODEL`；官方接口使用 `PSS_LOCAL_PROVIDER=openai`、`OPENAI_BASE_URL=https://api.openai.com/v1`。接口类型按资源方实际支持填写 `OPENAI_API_MODE`。兼容代理需要项目组审核适配，不冒充官方服务。

保持 `PSS_LOCAL_ALLOW_DIAGNOSTIC_RUN=0`、`PSS_AUX_ENABLED=0`，直到步骤 5 放行。不要上传 env、key、登录 cookie 或完整私有配置。**填好配置不等于连通性验证通过。**

## 2. 只准备 WAV 官方任务

```bash
(
set -euo pipefail
cd /srv/pss/repo/code
git clone https://github.com/ServiceNow/webarena-verified \
  artifacts/benchmark-snapshots/webarena-verified
git -C artifacts/benchmark-snapshots/webarena-verified checkout --detach \
  6473f72db5dcefc97b5725b59e734504edc28a21
python3 local-lab/prepare_navigation_runtime.py --benchmark wav \
  --source artifacts/benchmark-snapshots/webarena-verified \
  --output /srv/pss/runs/wav-inputs-001
)
```

检查输出中的 `report.json`、`candidate-inventory.json`、`prepared-candidates.json`、`task-bindings.json`。812 是固定源人口；导入阻塞必须保留，不以换题解决。`actor/` 是公共任务输入，`supervisor/` 和 `evaluator/` 是私有设置与评测信息，不能放进模型 prompt。

导入有 blocked 项时工具会生成报告并以非零退出：保留并交回 `wav-inputs-001/report.json` 及 `prepared-candidates.json` 的 blocked 清单，暂停任务派发；仍可独立做步骤 3 的离线检查。

**此步不启动网站，也不执行任务。** 2/10/20/100 项名单需在执行前由项目组固定并交付；不得运行后挑成功项。现有 `prepare_wav100_campaign.py` 生成的是 Qwen、Shopping 单站开发计划，不是 GPT 全站计划，不直接用于本次派发。

## 3. 运行不付费的离线检查

```bash
(
set -euo pipefail
cd /srv/pss/repo
node scripts/check-docs.mjs
./scripts/check-public-boundary.sh
cd code
npm run study:validate
node local-lab/sponsor-portable-verify.mjs \
  --python python3 --output /srv/pss/runs/offline-001
)
```

通过标准：命令成功退出，`offline-001/report.json` 没有失败，源码检查前后不变；所有 `not-run` / skipped 单独记录，不能计为通过。`study:validate` 目前验证保留的论文 v2.1 契约，不批准其旧三 benchmark 调度计划。离线套件包含 VWA/ATA 的合成代码回归，**不要求部署它们，也不计入本批实验**。

此处不使用 `--with-artifacts`、`--framework-profile`。旧 `sponsor-portable-doctor.mjs` 和完整 profile 仍要求三 benchmark 输入，暂不作为 WAV-only 执行命令；不要为让旧检查变绿而额外安装 VWA/ATA。

**交回：发行 commit、OS/Node/Python/Docker 版本、步骤 2 的导入报告与 blocked 清单、`offline-001/` 完整报告。失败时同时交回对应日志，先停在此步修复。**

## 4. 部署与验收 WAV 环境——先由项目组交付

不是所有 WAV 任务都只需要购物站。部署范围由冻结名单的 `sites` 和起始页决定，包括可能的 Shopping、Shopping Admin、Reddit、GitLab、Wikipedia、Map。只部署 Shopping 时明确标注为 Shopping 子集，不声称覆盖整个 WAV。

项目组必须给出一份与发行 commit 对应的环境包，包含：

- 选定站点的镜像摘要、部署/启动命令、端口及账号设置、实际存储需求。
- WAV evaluator、AgentLab/BrowserGym、Browser Use 三套独立 Linux Python 环境的安装锁与安装命令；本地 Mac 锁不能直接当作 Linux 验收锁。
- 本次 task ID 白名单、public input/setup/evaluator 哈希绑定、Traditional 脚本与来源记录。
- 可执行的 reset、认证、跨实例隔离、原生 evaluator 对照及 cleanup 验收命令；不是只有 JSON 模板。

验收标准：每次执行前独立 reset；需要登录的任务账号正确；多页面输入完整；实例 A 的变更不影响 B；reset 后恢复规定基线；原生 evaluator 正/负对照正确；失败实例隔离且不被下一任务复用。记录证据和未覆盖状态。

现有 Shopping reset/peer 探针只验证两张表和一个文件 marker，**不是所有数据库、缓存、索引、上传状态的隔离证明**。技术细节按 [WAV 适配说明](docs/technical/benchmarks/WAV.md)核对；[综合安装参考](code/local-lab/cloud-handoff/README.md)仅查 WAV 和公共依赖章节，跳过 VWA/ATA。

## 5. GPT 小批联调：2 → 10 → 20 个任务

**当前停止点：没有已验收、可直接交给实验人员的 WAV-only GPT 批量命令。** 项目组必须先交付实际命令和配置绑定；不要把以下配置表当作已实现的一键启动器。

同一批官方 task ID，使用同一个准确模型版本，运行四个配置（对应三种范式）：

| 范式 | 执行配置 | 模型允许看到什么 |
| --- | --- | --- |
| Pure visual | AgentLab / BrowserGym visual | 公共任务、截图、声明的自身动作/预算状态；无 DOM、AX、URL 或隐藏评测反馈 |
| Hybrid | AgentLab / BrowserGym hybrid | 同上，加受限的可见控件投影 |
| Hybrid | Restricted Browser Use hybrid | 同一 Hybrid 信息边界，不启用默认全套工具、额外 judge 或 fallback |
| Traditional | Playwright | 预先准备的固定脚本；运行时不调用 LLM |

用户已允许 AI 辅助编写本批**诊断** Traditional 脚本。必须记录该来源，作者不读取 gold/evaluator internals 或其他臂结果；不能据此标为正式人工独立盲写基线。

付费前确认：白名单与四配置冻结、共享费用预留与硬停止实际接入所有请求路径、价格/总预算/单任务预算明确、API 项目限额确认、无隐式切模型/无限重试。共享 guard、控制台和原生框架传输已在最新主线整合，但仍需核验真实价格、全部计费路径与目标主机行为。默认 CNY 1500 开发策略不是平台完整费用闭环的证明；资源方须确认实际限额。任务、setup/evaluator、执行器与 schedule 的哈希按当前 v3 收据绑定，旧收据不得改字段复用。

首批单 worker 串行跑 2 项 × 4 配置 = 8 次；审核通过后累计扩到 10 项 × 4 = 40 次，再到 20 项 × 4 = 80 次。嵌套扩展不把前一批重复计数。每一步检查 reset → actor → HAR/原始答案封存 → 原生评分 → cleanup，以及截图、动作、模型 usage 和计时是否完整。

**链路正确但任务失败，保留为方法结果；环境/认证/动作执行器/评测损坏，标为工程阻塞并停止放大。** 不给 CUA/Hybrid 偷加信息，也不重试到成功或删除失败任务。修复后用新版本、新输出目录复验，旧失败和费用保留。

## 6. 扩量、观测与交回

20 项验收后，再批准同一冻结 WAV 名单扩到每配置 100 个不同任务：4 配置 × 100 = **400 次计划执行**。重复调用和重跑是额外 attempts，不是新任务。后续模型/重复轮次另行冻结，不直接启动旧 19 配置 × 12 轮计划；本轮仍是 diagnostic，不自动升级 confirmatory。

控制台是辅助查看，不代替原始证据。在另一终端启动现有本地实验控制台：

```bash
(
set -euo pipefail
cd /srv/pss/repo/code
PSS_LOCAL_ENV_FILE=/srv/pss/private/provider.env node local-lab/server.mjs
)
```

按启动输出访问本机地址，远程访问使用 SSH 隧道，不公开控制端口。它不保证自动发现 `/srv/pss/runs` 中任意新批次；项目组需验证本批数据接线后才称为实时观测。未显示结果时先查落盘文件，不能认定任务未执行。

每批交回以下内容（原始敏感轨迹私下传输；公共仓库只提交检查过的脱敏汇总）：

1. **身份与配置：** release commit、任务清单/来源哈希、配置/模型/预算、环境与框架版本。
2. **全部执行证据：** 每次 reset/认证/隔离/cleanup 收据，逐步截图、动作、请求 usage、HAR、原始最终答案和原生评分日志。
3. **汇总表：** task ID、template ID、配置、attempt ID、终止状态、native score 或 unavailable、actor/评测/生命周期耗时、请求/token/费用或 unknown、失败分类、证据路径。
4. **问题清单：** 方法失败、脚本适配失败、工程/外部阻塞分别列出；缺失指标不填 0。Traditional 适配失败保留在 deployment 分母，评测异常不冒充模型 0 分。

WAV 主要结果按原生任务成功及 template-macro 汇总；同时报告部署覆盖、可靠性、耗时与成本。**本批不报告 ATA 的 PASS/FAIL 分类和失败步骤准确率，也不生成三 benchmark 合并结论。**

## 遇到问题，只需反馈这四项

`停在第几步 + release commit + 输出目录/失败日志 + 期望行为与实际行为`。不要贴 API key。运行超时、限流、余额不足、镜像不完整等归因必须留证；不能让实验人员通过修改准入布尔值或任意增加预算来“跑通”。
