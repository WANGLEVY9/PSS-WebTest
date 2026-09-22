# 云主机安装、依赖交付与实验验收手册

实验执行总入口：[GPT API 接入与实验操作手册](../../../README-EXPERIMENT-OPERATORS.zh-CN.md)。本文件专注主机/资产安装；实验矩阵、分批调度、成本值守和交回流程按总手册执行。

维护日期：2026-09-22。用途：赞助商实验人员在独立 Linux 主机部署、检查和执行新研究批次。

**当前交付级别：部署与验收准备材料，尚非已完成真实端到端验收的实验发行版。** 本地无法承载全部环境时，环境验收转移到赞助商云机；项目组仍负责部署适配、失败诊断与验收闭环。不能让赞助商通过大规模付费试跑发现代码问题。

## 1. 版本与证据边界

本手册的当前运行实现基线为主线提交 `de93d32`；三个benchmark与四套框架的接口见[技术文档](../../../docs/technical/README.md)。共享人民币预算在独立 `codex/sponsor-acceptance-bound-input` 分支的 `0b7301a` 中实现，尚未集成到此主线；该分支更强的task manifest/lease收据绑定同样不能当作主线行为。**交付前必须合并为一个完整发行提交，并在该提交重跑验证；不能混用两个工作区中的文件。** 未推送的提交不能假定可从 GitHub 克隆，应由项目组提供包含完整发行提交的 Git bundle 或源码包，以及 SHA-256 校验清单。

研究入口是 `code/config/active-study-design.json`。当前计划：WAV 600/812、VWA 700/910、ATA 113/113；ATA 标签为62 PASS、51 FAIL；19配置、D1–D2与V1–V10。计划量不等于已执行量。历史 `benchmark-artifact-manifest.v1.0.json` 在此只用于源码固定版本，不能使用其中旧的ATA 112条计数。

2026-09-22只读查询到本地 Docker 为 aarch64、4 CPU、8,307,163,136字节内存。它不是 Linux x86_64 云端验收环境；本次未测量镜像完整展开峰值，不能据此捏造精确最低磁盘容量。

| 状态 | 本次可提供的证据 | 仍需完成 |
|---|---|---|
| 源码核对 | 三套benchmark固定commit、框架候选锁、VWA安装/环境脚本检查 | 云端下载文件与运行镜像校验 |
| 本地工程测试 | [主线历史验证记录](../../../docs/STATUS.md)与独立预算分支的439项离线检查分别留存 | 不将不同分支测试数相加；完整发行提交复验与Linux新机复验 |
| VWA | 固定源码的依赖与站点配置已梳理 | 全站初始化、图片/登录状态、评测模型、每臂reset与框架端到端 |
| 框架 | AgentLab/Browser Use源码与组件探针持续开发 | 所有SDK请求接入共享账本、完整生命周期验收 |
| 正式实验 | 继续阻止 | 验收完成后另行冻结和批准新批次 |

## 2. 云主机与容量计划

使用独立原生 Linux x86_64 主机、Docker Engine及Compose v2、本地SSD/EBS类块存储；SQLite账本不可放NFS。先以一个隔离环境、一个worker验收，再根据实测扩大并发。不要依靠ARM模拟结果推断x86_64性能。

VWA固定版本的[环境说明](https://github.com/web-arena-x/visualwebarena/blob/89f5af29305c3d1e9f97ce4421462060a70c9a03/environment_docker/README.md)给出了1,000GB卷的AMI部署建议。这是上游方案，不是本项目测得的最小容量，也不表示该AMI今天仍可直接使用。云平台、AMI可用性、镜像授权与报价须由实际云端管理员确认。本项目优先提供自建路径，不要求特定云厂商。

容量采购前填写 `acceptance-receipt.example.json`：

- 磁盘峰值 = 下载压缩包 + 解包tar/SQL + Docker展开层 + 数据卷/重置基线 + 浏览器/模型缓存 + 运行证据 + 运维预留。避免把这些同时存在的文件只算一遍。
- CPU/RAM：记录空载、站点启动峰值、reset峰值、单worker峰值，再逐级增加worker。安装成功不等于并发可承受。
- GPU：远程视觉API不代表本地完全无需GPU。VWA部分评测依赖captioning，必须按选中任务核对评测模型；上游BLIP-2-T5XL示例约12GB显存，不是所有任务/模型的统一最低值。CPU替代必须通过原生语义与耗时验收，不能直接删掉评测步骤。
- 测量Docker实际 `DockerRootDir` 所在文件系统的可用空间；不能用Mac宿主机剩余磁盘代替虚拟机或远程daemon容量。
- 预算1500元是模型API的开发验收额度；云主机、磁盘、下载流量、GPU租用费用另列，不包含在API账本中。

只读调查命令（在云机执行，输出留在私有目录）：

```bash
uname -sm
node --version
python3.11 --version
python3.12 --version
uv --version
docker version
docker compose version
docker info --format '{{.Architecture}} {{.NCPU}} {{.MemTotal}} {{.DockerRootDir}}'
docker system df -v
df -h
free -h
```

系统软件由云端管理员使用批准的镜像/软件源安装；记录精确OS、内核、Node、Python、uv、Docker版本。不要运行会更新本机所有软件的无差别升级命令。Node要求>=20；浏览器系统库用对应版本的Playwright安装命令解决。

## 3. 依赖总表与固定来源

机器可读总表见 `dependency-manifest.json`，逐包声明见 `dependency-packages.csv`（本次导出849条，按环境保留重复包）。CSV是**源码/候选锁声明的库存**，不是已在Linux解析成功的最终安装锁。先完成第4节的源码克隆与固定版本 checkout，再在 `code/` 目录重新生成到新目录：

```bash
python3 local-lab/cloud-handoff/export-dependencies.py \
  --vwa-source artifacts/benchmark-snapshots/visualwebarena \
  --output /srv/pss/runs/dependency-inventory-001
```

导出器会校验VWA requirements确实来自固定commit，不联网、不安装依赖、不写实验记录。

| 组件 | 固定输入 | 安装隔离与关键限制 |
|---|---|---|
| 控制台/调度/Playwright脚本 | `code/package-lock.json` | `npm ci`；按该包安装Chromium，不能借用其他venv的浏览器版本 |
| WAV原生评测 | ServiceNow/webarena-verified @ `6473f72db5dcefc97b5725b59e734504edc28a21` | Python>=3.11；新增Mac arm64本地锁仅供诊断，仍需Linux完整锁 |
| VWA原生环境/评测 | web-arena-x/visualwebarena @ `89f5af29305c3d1e9f97ce4421462060a70c9a03` | Python3.10或3.11，不能直接装进3.12；其Playwright为1.37.0 |
| ATA来源 | Smartesting/pinata @ `650b9edaa055915cb27d2498f379a66430cc3e02`；Zenodo DOI 10.5281/zenodo.15198569 | 发布ZIP及六个CSV分别校验；远程Actor/Assertor流程不等于已验证的独立oracle |
| AgentLab / BrowserGym | 0.4.2 / 0.14.2，`config/frameworks/h-agentlab.lock` | 候选Python3.12独立venv；锁内Playwright1.44.0；Linux完整解析仍需验收 |
| Browser Use | 0.13.10，`config/frameworks/h-browser-use-journaled-actuator.lock` | 候选Python3.12独立venv；现有锁含pyobjc，不能原样当Linux锁安装 |
| GPT调用 | 私有provider配置、已核验价格表 | key与模型ID不写入依赖包；没有价格与上下界不得付费运行 |

Linux锁的制作是交付工作：在目标OS/Python上保留目标框架版本，单独解析平台条件与依赖冲突，输出完整精确版本及可用的wheel哈希、`pip check`、导入/浏览器验证记录。不能删除pyobjc行后就宣称等价，也不能用最新版替换不兼容包而不记录补丁。原VWA requirements的历史依赖组合也需实际resolver验证；报错应归入依赖适配，不属于“只差增加内存”。

下载源分组：GitHub源码；npm/PyPI或批准镜像；Playwright浏览器下载服务；Docker registry；VWA官方镜像归档；Zenodo发布包；可能需要的Hugging Face模型权重。记录实际URL、下载时间、大小、SHA-256、许可证及失败重试次数。代理/TLS证书问题应修复信任链，不关闭证书校验。

## 4. 目录、源码与通用安装

建议将源码、资产缓存、运行输出、账本分开。以下假定发行版已放在 `/srv/pss/repo`，目录所有权由管理员分配给实验账号；路径均可改，但须写进部署profile。

```text
/srv/pss/repo/                  完整固定发行提交
/srv/pss/assets/                tar、SQL、ZIP、zim、模型与浏览器缓存
/srv/pss/envs/                  wav、vwa、agentlab、browser-use独立环境
/srv/pss/private/               provider.env、spend-policy、共享账本、凭证
/srv/pss/deploy/vwa/            配置修改与生成任务的工作副本
/srv/pss/runs/                  各阶段证据与报告（新路径，禁止覆盖）
```

进入发行代码，验证包的SHA-256和 `git rev-parse HEAD` 与交接单一致后：

```bash
cd /srv/pss/repo/code
umask 077
mkdir -p artifacts/benchmark-snapshots artifacts/local-runtime
npm ci
npx playwright install --with-deps chromium
node local-lab/sponsor-portable-verify.mjs --python python3 \
  --output /srv/pss/runs/offline-001
```

输出目录必须不存在。成功标准是report各项通过、没有被忽略的失败、源码验证前后未变；4个历史产物测试组的not-run不算通过。此阶段不需要模型密钥，不安装/启动大型站点，不运行论文实验。

在上述 `code/` 目录获取全新benchmark源码（已有目录先核验，不覆盖）：

```bash
git clone https://github.com/ServiceNow/webarena-verified artifacts/benchmark-snapshots/webarena-verified
git -C artifacts/benchmark-snapshots/webarena-verified checkout --detach 6473f72db5dcefc97b5725b59e734504edc28a21
git clone https://github.com/web-arena-x/visualwebarena artifacts/benchmark-snapshots/visualwebarena
git -C artifacts/benchmark-snapshots/visualwebarena checkout --detach 89f5af29305c3d1e9f97ce4421462060a70c9a03
git clone https://github.com/Smartesting/pinata artifacts/benchmark-snapshots/pinata
git -C artifacts/benchmark-snapshots/pinata checkout --detach 650b9edaa055915cb27d2498f379a66430cc3e02
```

源码副本保持原样供doctor核验。另复制VWA到 `/srv/pss/deploy/vwa`，只在此副本写生成配置、`.auth`和部署补丁；记录与固定源码的差异。实际adapter必须明确引用这个工作副本和生成文件哈希，不能仅凭原始checkout干净就认定运行代码一致。

## 5. VWA逐服务依赖与配置

| 服务 | 上游资产/运行组件 | 私有主机端口 | 初始化与验收 |
|---|---|---:|---|
| Classifieds | `jykoh/classifieds`、MySQL、固定源码下的SQL初始化材料 | 9980 | 固定实际image digest；首次SQL导入；URL与reset token一致；登录/上传/重置状态验证 |
| Shopping | `shopping_final_0712.tar` | 7770 | Magento基础URL、secure URL、缓存与索引设置；验证重置后购物状态 |
| Reddit/Postmill | `postmill-populated-exposed-withimg.tar` | 9999 | 页面与图片完整、登录有效；帖子变更可回到基线 |
| Wikipedia | `wikipedia_en_all_maxi_2022-05.zim`、Kiwix serve 3.3.0候选镜像 | 8888 | 固定镜像digest和zim校验；作为选中任务依赖核对，不因为首页可达就略过 |
| Homepage | 固定源码 `environment_docker/webarena-homepage`、Flask独立依赖锁 | 4399 | 链接指向浏览器实际可达URL；task输入图片URL可访问 |

下载入口见固定版本[上游环境文档](https://github.com/web-arena-x/visualwebarena/blob/89f5af29305c3d1e9f97ce4421462060a70c9a03/environment_docker/README.md)。归档镜像体积大，本地未重新下载验证；不提供虚构的文件大小或SHA。先下载到临时文件，核对取得的资产，再改名归档、执行 `docker load --input`。本地计算SHA只是记录本次文件，仍需与可信交付清单比较才能宣称完整性验证。

导入后的运行模板（**仅首次、专用新环境；image ID须来自核验后的实际导入**）：

```bash
docker load --input /srv/pss/assets/shopping_final_0712.tar
docker image inspect shopping_final_0712 --format '{{.Id}} {{.Architecture}}'
# 将审核后的完整 sha256:... 赋给 PSS_VWA_SHOPPING_IMAGE_ID，不能仍使用 latest。
docker run --name pss-vwa-shopping -p 127.0.0.1:7770:80 -d "${PSS_VWA_SHOPPING_IMAGE_ID:?verified image ID required}"
```

Reddit按同样流程使用独立容器名、9999→80；Wikipedia只读挂载zim目录，8888→80。Classifieds将官方compose复制到部署目录：把web端口改为 `127.0.0.1:9980:9980`，两服务改成实验专用容器名，固定两个镜像digest，数据库不映射公网端口。SQL材料与数据库卷记录哈希/身份；reset token放权限600的私有环境文件，保留应用读取所需的容器环境变量。不要把模板中的公开默认token当作私有凭证。

首次数据库初始化、Magento URL/缓存/索引操作按固定上游说明进行，将其中容器名与主机URL替换为本次部署值并留存补丁。SQL导入不是每次启动都可无条件重做的步骤；再次执行前确认是否需要销毁状态，禁止覆盖正在采集的数据库。

端口7770也可能被WAV购物站使用：不同benchmark应串行独占环境或使用独立端口/实例；同源镜像不意味着两个benchmark允许共享可变状态。若浏览器运行在Docker里，127.0.0.1指向浏览器自身，必须使用其实际可达私有DNS，并同时更新任务、图片、站点base URL、cookie域与reset端点。不能只在控制台改一个地址。

网络原则：站点与控制台绑定loopback或受控私网，控制台通过SSH转发访问；不照抄上游“开放全部入站”的历史步骤。云机本地浏览器方案可使用：

```bash
ssh -N -L 4173:127.0.0.1:4173 EXPERIMENT_USER@CLOUD_HOST
```

## 6. VWA Python、任务图片、登录和评测

原始安装方法见固定版本[README](https://github.com/web-arena-x/visualwebarena/blob/89f5af29305c3d1e9f97ce4421462060a70c9a03/README.md)。下面是**云端依赖解析与验收阶段**，不是已验证的Linux锁安装承诺：

```bash
python3.11 -m venv /srv/pss/envs/vwa
/srv/pss/envs/vwa/bin/python -m pip install -r /srv/pss/deploy/vwa/requirements.txt
/srv/pss/envs/vwa/bin/python -m pip install -e /srv/pss/deploy/vwa
/srv/pss/envs/vwa/bin/python -m pip check
/srv/pss/envs/vwa/bin/python -m playwright install --with-deps chromium
```

任何resolver或导入失败都停止此阶段，记录冲突包与修复补丁，不自动升级全环境。得到审核后的Linux完整锁后，新机以该锁重建而非重复开放解析。Flask主页依赖不应临时塞入其他框架环境，应有独立小环境和锁。

将 `vwa.env.example` 复制为私有文件，填写URL/token，权限设为600；它不含模型key。使用文件内容前只接受项目组提供的可信配置，因为下面的 `source` 会执行shell内容。

```bash
cd /srv/pss/deploy/vwa
set -a
source /srv/pss/private/vwa.env
set +a
/srv/pss/envs/vwa/bin/python scripts/generate_test_data.py
/srv/pss/envs/vwa/bin/python browser_env/auto_login.py
```

检查三类原始配置合计910条且使用site-scoped任务ID；生成配置的URL替换不能改变原始intent/图片/原生eval语义。逐任务检查图片字节、MIME、URL、缓存SHA；缺图片的任务标blocked，不能换成文本描述继续算多模态结果。`.auth`私有存储，重置后验证登录状态；失败断言可能包含token，完整日志不能直接公开。

主线当前只接入deterministic-only评测；需要fuzzy text/VQA的任务仍阻止，不能删掉这些任务来宣称完整VWA验收。VWA `PageImageEvaluator`可能调用captioning函数。交付清单必须记录评测模型ID、revision/权重SHA、tokenizer、Torch/CUDA、设备和缓存；不能把其费用/时延藏在actor统计里，也不能将caption答案泄漏给pure visual actor。相似度/字符串/页面检查必须保持原生端点，至少做明确正例、负例与错误定位控制。

不要执行上游 `run.py` 示例当作本研究正式入口：它使用上游agent配置，且可能绕过本项目1500元共享预算。安装单测与组件测试也应在无付费key环境运行，并检查是否会联网下载权重。

ATA原始镜像的本地可达性与容量调查见[2026-09-22可行性记录](../ATA-LOCAL-DEPLOYMENT-STATUS-20260922.md)；这些是该机器该时点的观察，不是对所有云机的结论。

## 7. 每臂reset与框架接口

### WAV与ATA的额外部署闭包

WAV不能仅部署购物站就声称覆盖600个选择任务。固定版本提供shopping、shopping_admin、reddit、gitlab、wikipedia、map六站；从**正式选择的每条任务的sites/start_urls**取依赖并集，保留多站任务关系。主线已有shopping单站owned lifecycle；其他站点及数据卷digest与生命周期仍需项目组交付，不能从“最新镜像能启动”推断版本符合。

| WAV站点 | 上游默认网页端口 / 控制端口 | 必须额外核验 |
|---|---|---|
| shopping | 7770 / 7771 | 初始化、购物状态及原生network trace语义 |
| shopping_admin | 7780 / 7781 | 管理端数据库与授权登录 |
| reddit | 9999 / 9998 | 图片、帖子和用户状态 |
| gitlab | 8023 / 8024 | 预置仓库、用户、项目与base URL |
| wikipedia | 8888 / 8889 | 数据目录及只读数据挂载；不能拿任意wiki代替 |
| map | 3030 / 3031 | setup下载、地图瓦片、routing car/bike/foot、Nominatim及数据库卷 |

上述是固定源码的默认端口，均应改为loopback/受控私网映射，控制端口不可公开。WAV地图容器在固定README中仍称beta，应单独验收；其体积和初始化峰值不能按购物镜像估计。WAV独立venv使用固定源码包及审核的Linux锁；原生评测输入包括agent输出和捕获的network trace，需验证回放与原始HTTP数据的绑定。

ATA发布包为 `ISSTA_ARTEFACT.zip`，本项目记录的SHA-256为 `c0b0a21f3ca5871f8c6db59e7d015e04350c577aef8714091e40246dc8fcb3bf`，来源DOI `10.5281/zenodo.15198569`。下载后再校验；六个CSV的独立SHA及113条解析口径在 `config/ata-source-population.v1.json`。CSV原始行数不是任务数。

ATA涉及classifieds 30、onestopshop 49、postmill 34条任务。主线 `pss-ata-reference-evaluator-v1` 是参考标签比较器；尚需实际fixture与标签一致性验收，它不是上游已交付的独立运行时oracle。[原论文第4.2–4.3节](https://arxiv.org/html/2504.01495v1)以修改测试指令、要求未实现功能构造FAIL案例，并不要求51个变异应用版本；原应用数据、账号、基线状态与reset条件仍必须分别核验，不允许直接共享正在运行的数据库。上游piñata提供`uv.lock`和非LLM单测标记；如需运行原作者组件，用独立环境、固定锁及无key的 `uv run pytest -m 'not llm'` 检查，不能拿其多Agent orchestrator/actor/assertor默认执行当作本研究的公平三臂实现。公开远端reset/GitHub Actions依赖尚未移植时，应登记为工程阻塞，不能对无关共享服务发起reset。

### 统一执行接口

reset必须在每个任务×配置×轮次开始前完成，直到cleanup结束环境锁才释放；一次batch开始时reset不够。上游reset脚本含宽泛容器匹配删除、固定端口/localhost和固定等待，不能原样用于共享云主机。项目组应交付限制在精确容器名/image ID的reset适配器，保留基线数据库、文件/上传和认证状态的恢复语义，并以健康检查和状态摘要结束。

执行链：

```text
固定任务/输入/评测引用/执行器/配置摘要
 → 幂等入队 → 独占环境租约 → 每臂reset及基线核验
 → 原生框架执行（每次API预留；逐动作journal）
 → 独立原生评测 → cleanup → 持久结果 → 只读导出/分母核对
```

当前主线采用 `diagnostic-receipts-v2`，reset/actor/evaluator/cleanup校验opportunity、environment、configuration；租约与输入证据还由worker/session分别校验。[输入输出契约](../../../docs/technical/INPUT_OUTPUT.md)列明当前字段和分支差异。统一task manifest、执行器命令与完整lease绑定是发行集成的验收项，不能把另一分支v3收据格式直接套入主线。API费用未知不释放预留；崩溃后已触碰环境的机会隔离为uncertain，不自动重跑。重置失败、评测不可用、任务失败、预算中断分别记录。

最终发行版必须提供真实WAV/VWA/ATA输入映射与各臂reset/actor/evaluate/cleanup绑定。`runtime-bindings`示例中的空命令不代表已经接通。AgentLab纯视觉不能默认读DOM，Browser Use必须使用限制后的观察/动作边界；没有身份与边界证据不能只改框架名字后开始收集。

## 8. 统一预算、控制台和逐级验收

**尚未具备全链路人民币预算保护。** [共享预算设计](../SPEND-CONTROLS.md)记录独立工程分支，须先完成主线集成、全部请求路径测试和价格核验，才能按以下阈值运行付费验收。目标1500元总账本：80%提醒、90%严重告警、95%停止新任务；每次执行15元/30次请求/240秒为开发默认。所有worker必须使用同一数据库路径；多机应先实现统一网关，不能各拿1500元本地额度。价格表为空、调用链绕过账本、SDK重试未计费时，付费canary继续阻止。

控制台在 `code/` 目录启动：

```bash
PSS_LOCAL_ENV_FILE=/srv/pss/private/provider.env node local-lab/server.mjs
```

主线provider模板来自 `local-lab/openai.env.example`。共享账本路径、预算/告警面板与暂停控制需在合并预算分支后的发行版验证；当前主线控制台不保证提供它们。用浏览器访问SSH转发后的4173端口，核对模型ID与未放行状态，不能把启动按钮可见理解为真实框架已验收。

复制 `config/sponsor-deployment.example.json` 到私有profile，填入所有源码、venv、Linux锁、实际DockerRootDir、实测空闲容量要求、完整容器名及local image ID，再运行：

```bash
cd /srv/pss/repo/code
node local-lab/sponsor-portable-doctor.mjs \
  --profile /srv/pss/private/deployment.json --live-docker \
  --output /srv/pss/runs/doctor-001.json
node scripts/probe-visualwebarena-local-assets.mjs
node scripts/probe-visualwebarena-environment-gate.mjs
```

后两个脚本使用当前Docker context以及导出的 `PSS_VWA_*`；它们只是旧版资产/HTTP到达性辅助探针，**不检查完整Wikipedia/图片/认证/评测依赖，也不能授予准入**。映射按env示例配置；doctor退出2代表失败或未验证。镜像归档ID与registry digest不同，profile字段 `expected_image_digest` 实际要求本地image ID。

| 阶段 | 执行内容 | 通过条件 / 停止条件 |
|---|---|---|
| L0，无API | 源码哈希、依赖安装、浏览器启动、离线单测 | 必须全通过；缺锁或安装失败先修复 |
| L1，无API | 每服务启动、图片、cookie、基线、每臂reset | 三次reset状态一致；失败保留证据，不运行actor |
| L2，无actor调用 | 原生evaluator明确正/负对照；框架固定响应组件探针 | 身份、动作、观察边界、评测分母正确；评测模型自身费用需单列 |
| L3，有界付费 | 先每benchmark两条预先选定官方开发任务覆盖四类执行配置 | 先核验真实价格/请求账本；链路完成与任务成功分开，不要求模型全对 |
| L4，扩展开发验收 | 按[验收runbook](../ACCEPTANCE-RUNBOOK.md)预登记的cohort逐级扩大 | 所有失效归因、重置重复、成本核对通过；不因失败换任务 |
| L5，正式前冻结 | 环境/配置/任务/预算/脚本/分析版本全冻结 | 项目组出具验收结论；开发数据不得混入D1/D2/V1–V10 |

云端不能启动L3时，项目组交付的应是可诊断的blocked报告与缺项清单，不能声称“只要填key就能跑”。

## 9. 排障与恢复

| 现象 | 首查 | 处理 |
|---|---|---|
| `exec format error` | 镜像/主机architecture | 获取核验后的amd64镜像；不静默改成模拟执行 |
| `distutils`或Python依赖冲突 | 是否把VWA装进3.12；原requirements解析 | 分离3.11环境；记录resolver日志并审查Linux锁 |
| pyobjc安装失败 | 是否用了Mac Browser Use锁 | 项目组解析审核Linux锁，不安装最新版碰运气 |
| 空间不足/OOM | daemon存储根、展开临时文件、卷/模型缓存、内存峰值 | 扩容或降低并发；禁止无差别 `docker system prune -a --volumes` |
| 首页可达但任务失败 | 重定向目标、图片、cookie域、初始化SQL | 从浏览器所在网络验证具体资源，不能只看HTTP 200 |
| reset后结果漂移 | 数据卷/上传/基线/索引与环境并发 | 隔离环境，比较三次状态摘要；未查清不重试采集 |
| 预算/认证429 | provider错误码、共享账本告警 | 停止后续任务，核验账户配置；不自动升额或重放 |
| worker崩溃 | 租约、是否已触碰环境、未知请求 | 保留DB/WAL；隔离uncertain；账单证据人工对账后恢复 |
| 端口7770冲突 | WAV与VWA部署/遗留容器 | 使用专用实例或一致的新端口映射；不停止无关容器 |
| doctor红灯但网站可用 | 源码干净度、镜像ID、Linux锁、空字段 | 按具体check补证据；不手改ready=true |

## 10. 实验人员交回的材料

填写 `acceptance-receipt.example.json`，附发行commit、Linux完整锁与哈希、安装日志摘要、资产校验、部署profile（去凭证）、实际image IDs、CPU/RAM/磁盘峰值、任务/图片映射、三次reset证据、原生正负对照、框架版本与观察边界、每次请求成本对账、crash/恢复验证、导出分母报告。

原始key、cookie、token、HAR、截图、prompt和账单详细信息留在私有证据目录。复制SQLite使用一致性备份或停止写入后完整保存数据库及WAL，不能只复制正在运行的主文件。公开报告仅包含审核后的摘要和哈希。

交接责任：项目组提供完整发行包、适配器、Linux锁和失败修复；赞助商提供云机权限、网络/镜像访问和已授权模型服务，并协助测量运行。双方共同签收真实canary结果后，才考虑开始正式研究。
