# WebArena 实验运行指南：120 个任务，GPT‑6 Astra / GPT‑5.6 Sol

本次使用 **WebArena-Verified（WAV）中的同一组 120 个任务**，比较 GPT‑6 Astra 和 GPT‑5.6 Sol。只部署这些任务需要的网站。VWA、ATA 不在本次运行范围内。

**当前代码尚缺支持这两个 GPT 模型、任意任务清单的批量启动入口。** 以下安装、任务导入和配置检查可以执行；第 6 节列出启动前需要补齐的交付项。现有 Qwen 探针不能通过更换 API key 用于本批实验。

## 1. 要跑哪些实验

沿用项目的三种测试范式，每个任务运行以下配置，各一轮：

| 配置 | 框架与输入 | GPT‑6 Astra | GPT‑5.6 Sol |
| --- | --- | ---: | ---: |
| Pure visual | AgentLab / BrowserGym；任务描述、截图 | 120 | 120 |
| Hybrid | AgentLab / BrowserGym；任务描述、截图、受限可见控件 | 120 | 120 |
| Hybrid | Restricted Browser Use；相同 Hybrid 输入边界 | 120 | 120 |
| Traditional | Playwright；预先准备的固定脚本，运行时不调用模型 | 两个模型共用 120 次基线 | — |

合计 **120 个不同任务、720 次模型驱动执行、120 次脚本基线，共 840 次执行**。这是本次一轮的运行安排；重试不增加任务数。两个模型使用相同 task ID、环境基线和预算限制，不在执行中切换模型。

运行顺序：先用名单中的 2 个任务检查完整链路，再累计扩到 10 个，最后完成 120 个。相同版本、配置下已经完成的执行直接复用记录。更改代码或配置后的重跑另存批次。

## 2. 准备主机与代码

使用 Linux x86_64 云主机，安装 Git、Node.js ≥20、Python 3.12、uv、Docker Engine 和 Docker Compose v2。实验账号需要 Docker 权限及 `/srv/pss` 的写权限。预算账本放本地磁盘。

主机需要访问 GitHub、npm、PyPI、Playwright 下载源、Docker registry 和模型 API。站点只开放给实验主机或受控私网；控制台通过 SSH 转发访问。

```bash
# 以下命令在 Bash 中执行；首次安装使用新的目录。
set -euo pipefail
umask 077
mkdir -p /srv/pss/{private,runs,envs,assets}
git clone https://github.com/WANGLEVY9/PSS-WebTest.git /srv/pss/repo
cd /srv/pss/repo
git rev-parse HEAD > /srv/pss/runs/release-commit.txt
cd code
npm ci
npx playwright install --with-deps chromium
```

后续运行固定这个提交；实验期间不执行 `git pull`。保留 `package-lock.json` 和各 Python 环境的安装清单。

框架需要独立 Python 环境：AgentLab 0.4.2 / BrowserGym 0.14.2，以及 Browser Use 0.13.10。使用项目组交付的 Linux 依赖锁安装；仓库中含 `pyobjc` 的 macOS 锁不能用于 Linux。安装工具及参数见 [bootstrap_sponsor_framework.py](code/experiment/bootstrap_sponsor_framework.py)。

## 3. 下载任务、部署网站

### 3.1 固定 WAV 版本并导入任务

```bash
cd /srv/pss/repo/code
mkdir -p artifacts/benchmark-snapshots
git clone https://github.com/ServiceNow/webarena-verified \
  artifacts/benchmark-snapshots/webarena-verified
git -C artifacts/benchmark-snapshots/webarena-verified checkout --detach \
  6473f72db5dcefc97b5725b59e734504edc28a21
python3 experiment/prepare_navigation_runtime.py --benchmark wav \
  --source artifacts/benchmark-snapshots/webarena-verified \
  --output /srv/pss/runs/wav-inputs
cat /srv/pss/runs/wav-inputs/report.json
```

导入报告应有 `official_candidate_tasks: 812`、`prepared: 812`、`blocked: []`。输入文件分为：

| 目录或文件 | 用途 |
| --- | --- |
| `actor/` | 提供给 agent 的公共任务输入 |
| `supervisor/` | 起始页面、站点、登录与重置配置 |
| `evaluator/` | 原生评测输入，仅评测进程读取 |
| `task-bindings.json` | 官方任务身份、文件位置及哈希 |

项目组需随运行包提供 `task-ids.txt`：每行一个官方 task ID，恰好 120 个，不重复。两模型和所有配置共用这份名单。名单在运行前固定，不能按执行结果换题。仓库中的 Shopping-only WAV100 名单是另一批实验。

将名单放到 `/srv/pss/private/task-ids.txt`，检查 ID 并列出所需站点：

```bash
python3 - <<'PY'
import json
from pathlib import Path
source = Path('/srv/pss/repo/code/artifacts/benchmark-snapshots/webarena-verified')
rows = json.loads((source / 'assets/dataset/webarena-verified.json').read_text())
by_id = {int(row['task_id']): row for row in rows}
ids = [int(s) for s in Path('/srv/pss/private/task-ids.txt').read_text().splitlines() if s.strip()]
assert len(ids) == len(set(ids)) == 120, '需要 120 个不重复的 task ID'
assert set(ids) <= set(by_id), '名单包含非官方 task ID'
sites = sorted({site for tid in ids for site in by_id[tid]['sites']})
print('任务数:', len(ids))
print('需要部署:', ', '.join(sites))
PY
sha256sum /srv/pss/private/task-ids.txt
```

### 3.2 安装官方环境管理与评测工具

```bash
uv venv --python python3.12 /srv/pss/envs/wav
uv pip install --python /srv/pss/envs/wav/bin/python \
  /srv/pss/repo/code/artifacts/benchmark-snapshots/webarena-verified
uv pip check --python /srv/pss/envs/wav/bin/python
uv pip freeze --python /srv/pss/envs/wav/bin/python \
  > /srv/pss/runs/wav-python-packages.txt
/srv/pss/envs/wav/bin/webarena-verified --help
```

这是从固定源码安装 WAV 工具；首次在目标主机解析的依赖清单应随运行记录保存。

### 3.3 启动名单需要的网站

按[固定版本官方环境说明](https://github.com/ServiceNow/webarena-verified/blob/6473f72db5dcefc97b5725b59e734504edc28a21/README.md#-environments)部署。下面以 Shopping 为例：

```bash
/srv/pss/envs/wav/bin/webarena-verified env start --site shopping
```

| 站点 | `--site` 参数 | 官方默认页面端口 | 环境控制端口 |
| --- | --- | ---: | ---: |
| Shopping | `shopping` | 7770 | 7771 |
| Shopping Admin | `shopping_admin` | 7780 | 7781 |
| Reddit | `reddit` | 9999 | 9998 |
| GitLab | `gitlab` | 8023 | 8024 |
| Wikipedia | `wikipedia` | 8888 | 8889 |
| Map | `map` | 3030 | 3031 |

Wikipedia 和 Map 先下载并初始化数据，再启动：

```bash
# 仅在任务名单包含相应站点时执行。
/srv/pss/envs/wav/bin/webarena-verified env setup init \
  --site wikipedia --data-dir /srv/pss/assets/wav
/srv/pss/envs/wav/bin/webarena-verified env start \
  --site wikipedia --data-dir /srv/pss/assets/wav
/srv/pss/envs/wav/bin/webarena-verified env setup init \
  --site map --data-dir /srv/pss/assets/wav
/srv/pss/envs/wav/bin/webarena-verified env start --site map
```

网站起来后，填写 WAV 环境配置：实际 URL、账号、密码、任务数据文件路径；格式参照上游 `examples/configs/config.example.json`。同一站点的浏览器地址、cookie 域和评测地址必须对应同一实例。记录镜像 digest 和数据卷位置。

每次执行都按 **reset → 登录 → 打开任务全部起始页面 → 执行 → 封存 HAR → 原生评分 → 清理** 的顺序运行。先串行跑；同一个可变站点不能同时供两个任务使用。当前项目 reset 实现覆盖 Shopping，其他站点需要对应的生命周期适配后才能纳入调度。

## 4. 配置两个 GPT 模型与预算

### 4.1 分别保存模型配置

```bash
cd /srv/pss/repo/code
install -m 600 experiment/openai.env.example /srv/pss/private/astra.env
install -m 600 experiment/openai.env.example /srv/pss/private/sol.env
install -m 600 config/spend-policy.json /srv/pss/private/spend-policy.json
```

编辑两个 `.env` 文件，填写以下字段。**`OPENAI_MODEL` 使用 API 资源方提供的准确模型 ID**；GPT‑6 Astra、GPT‑5.6 Sol 是本次实验的模型名称，不能据此猜接口 ID。

```dotenv
PSS_LOCAL_PROVIDER=openai
OPENAI_API_KEY=填写密钥
OPENAI_MODEL=填写该模型的API_ID
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_MODE=responses
PSS_LOCAL_MAX_OUTPUT_TOKENS=1024
PSS_AUX_ENABLED=0
PSS_LOCAL_ALLOW_DIAGNOSTIC_RUN=0
PSS_SPEND_POLICY_FILE=/srv/pss/private/spend-policy.json
PSS_SPEND_DB=/srv/pss/private/shared-spend.sqlite
```

如果资源方提供兼容接口，改用 `PSS_LOCAL_PROVIDER=openai-compatible`，填写实际 `OPENAI_BASE_URL`，并设置 `PSS_OPENAI_ALLOWED_ORIGIN` 为该地址的协议和域名，例如 `https://api.example.com`。`OPENAI_API_MODE` 按实际接口选择 `responses` 或 `chat-completions`。

两份配置共用同一个预算文件和账本。推理强度、输出 token 上限在试跑前定好，并在同一模型的不同配置间保持一致。密钥和登录凭证保留在 `private/`，不提交 Git。

### 4.2 填价格、确认阈值

在 `spend-policy.json` 的 `rates` 中分别填写两个模型的价格记录：

| 字段 | 填写内容 |
| --- | --- |
| `provider`、`model`、`base_url` | 与对应 `.env` 完全一致 |
| `input_usd_per_million` | 每百万输入 token 美元价格 |
| `cached_input_usd_per_million` | 每百万缓存输入 token 美元价格 |
| `output_usd_per_million` | 每百万输出 token 美元价格 |
| `max_input_tokens`、`max_output_tokens` | 接口允许计费的 token 上界，包含图像输入 |
| `source`、`verified_at`、`expires_at` | 价格来源及核验、失效时间 |

人民币计价的字段及格式见[费用配置说明](code/docs/runbooks/SPEND-CONTROLS.md)。同时核对 `fx_cny_per_usd`；默认 8 是预算换算值。空价格表会阻止请求，不能用其他模型的价格代填。

| 控制项 | 默认值 |
| --- | ---: |
| 费用预警 | ¥1,200 |
| 严重预警 | ¥1,350 |
| 停止接收新执行 | ¥1,425 |
| 已计费用与预留费用总上限 | ¥1,500 |
| 单次任务 × 配置执行上限 | ¥15 |
| 单次执行请求数 / 动作数 | 30 / 30 |
| 单次执行时限 / 单个请求时限 | 240 秒 / 45 秒 |

¥1,500 是两个模型共用的 API 总预算，云主机费用另计。先根据小批实测估算 840 次执行的费用，再扩量。完整上下文预留可能超过单任务 ¥15；此时调整经核验的计费上界或批准单任务限额，不能清空账本绕过限制。所有价格和限额在首次付费请求前确定。

## 5. 执行离线检查

```bash
cd /srv/pss/repo/code
node experiment/sponsor-portable-verify.mjs --python python3 \
  --output /srv/pss/runs/offline-001
```

查看生成的报告，修复失败项。该命令不调用 GPT、不运行网站任务。

控制台启动命令：

```bash
cd /srv/pss/repo/code
PSS_LOCAL_ENV_FILE=/srv/pss/private/astra.env node experiment/server.mjs
```

在自己的电脑执行以下转发，然后打开 `http://127.0.0.1:4173`：

```bash
ssh -N -L 4173:127.0.0.1:4173 EXPERIMENT_USER@CLOUD_HOST
```

控制台用于查看费用、预留额度、告警和暂停状态，目前没有本批 120 任务双模型启动按钮。告警显示在本地控制台，不发送邮件。

## 6. 批量启动前的交付与操作顺序

项目组需要补齐三项，实验人员拿到后即可按下列顺序运行：

1. **120 任务运行包**：固定 task ID、站点配置、Linux 框架锁、120 份 Traditional 脚本，以及输入、执行器和调度身份的绑定文件。
2. **GPT 批量入口**：读取 `astra.env`、`sol.env` 和共同任务名单，生成第 1 节的 840 次调度；支持费用预留、断点恢复和已完成执行去重。现有 `run_wav_qwen_pair.py` 固定 Qwen，`wav_official_acceptance_probe.py` 只接受任务 260、261、274，不能用于这一步。
3. **目标主机验收**：每种配置完成 reset、登录、动作执行、HAR 封存及 WAV 原生评分。现有 `provider-smoke.mjs` 还需接入共享预算 guard 后才能作为 GPT 连通性命令交付。

补齐后，启动顺序为：两个模型分别做一次图像接口检查 → 2 个任务 × 7 配置 = 14 次执行 → 累计 10 个任务、70 次执行 → 累计 120 个任务、840 次执行。项目组应把实际启动、恢复和汇总命令补入本节；本页不提供尚不存在的命令。

运行期间：模型答错保留结果；认证、reset 或评测失败则暂停该批并修复环境。网络超时先核对请求与费用记录，不直接重复发送。不为提高成功率补跑失败任务，也不自动换成便宜模型。

## 7. 保存与交回结果

每次执行保留 task ID、模型 API ID、配置、轮次、attempt、代码版本、起止时间、截图和动作轨迹、原始最终答案、完整 HAR、原生评分、token usage 与费用记录。先关闭浏览器上下文，确保 HAR 写完，再交给 WAV evaluator。

按 **模型 × 配置** 汇总完成数、可评分数、成功数、超时数、工程失败数和费用。每配置的计划任务数固定为 120；缺失和失败逐项列出。Traditional 共用基线只统计一次。完整 trace 和登录信息通过私有交付渠道传递。

运行结束交回：固定任务名单及哈希、代码提交、依赖清单、镜像 digest、去密钥配置、逐任务证据、汇总表，以及停止所有运行进程后导出的完整费用账本。

接口和评测细节见 [WAV 技术说明](docs/technical/benchmarks/WAV.md)；本批范围记录见 [WAV-only scope](docs/WAV-ONLY-EXECUTION-SCOPE.md)。
