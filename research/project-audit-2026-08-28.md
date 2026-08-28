# PSS-WebTest 项目全链路审计与科研目标对齐

更新时间：2026-08-28

本报告是当前状态的日期化审计快照。它优先于早期 checklist 中的概括性描述，但不改写历史记录。报告区分四种证据：代码实现、契约/配置验证、live smoke/pilot，以及可以进入 confirmatory 分析的证据。当前没有任何 confirmatory collection 或 confirmatory effect estimate。

## 1. 结论先行

项目科研目标仍然正确，且应明确表述为：

> 在匹配的 Web 测试意图下，估计 pure-visual CUA、hybrid visual+page-structure agent 和 accessibility-locator Playwright 在不同任务、oracle、功能缺陷、UI 演化、模型/provider 与运行预算下的条件化表现、失败模式、维护代价和互补关系，而不是寻找一个对所有场景都更好的全局赢家。

当前项目处于 **Phase 2 feasibility/admission pilot，尚未退出 Phase 2**。我们已经有一个可审计的三臂 vertical slice，以及两个真实视觉模型的 BookStack clean pilot；尚未有足够的跨 SUT、跨任务、跨条件重复数据来冻结 repetition、power 或开始 confirmatory collection。

最重要的科学判断是：

1. BookStack 的成功只能按 model/provider 分层解释，不能把 Qwen 和 Doubao 合并成一个 CUA 结果。
2. Qwen visual 的三次运行均达到 persisted task oracle，但只有 `oracle_only_success`，其中两次停在 step budget，一次出现 grounding loop；这不是 strict cell success。
3. Doubao 在 BookStack create-page clean task 的 3×3 matched pilot 中三臂均通过，但这只是一个任务和一个 clean condition，不能推出普遍等价或优越。
4. Indico 和 Juice Shop 的 CUA clean admission 尚未通过，因此不能进入它们的 fault/evolution agent blocks，更不能据此冻结样本量。

## 2. 审计范围与复核命令

本轮检查了仓库状态、最近提交、研究计划、预注册草案、manifest、benchmark matrix、metric dictionary、runner/driver、oracle、mutation、run-record schema/collector 和被忽略的真实 pilot artifact。执行了：

- `npm run test:contracts`：**50/50 passed**；
- `npm run validate:manifests`：**passed**，3 applications、4 manifest tasks；
- `npm run validate:benchmark-matrix`：**passed**，3 applications、15 workflows、4 model strata、5 traditional baselines；
- `npm run validate:study-assets`：**passed**，8 references、15 metrics、8 task blueprints、8 replication cases；
- 对当前代表性 outcome-v02 ledger 的审计：**24 records、24 unique run IDs、无 schema errors、三臂均存在**；
- `git diff --check`：**passed**；工作树在审计开始前与 `origin/main` 同步；
- live HTTP readiness：BookStack `127.0.0.1:8081` 返回 302，Juice Shop `127.0.0.1:3000` 返回 200，Indico 必须使用 hostname `localhost:8080` 才返回 200，直接访问 `127.0.0.1:8080` 为 404。这说明 Indico 的 hostname-sensitive 行为必须写入运行协议。

本轮还修正了两个测量层问题：run-record schema 与实际细粒度 failure taxonomy 对齐；汇总器不再把 `unknown` 或 `not-scored` 当作可评分 verdict。对应修正已由契约测试覆盖。

## 3. 研究设计与实现对齐

### 3.1 因素结构

设计单位是：

`application × task × condition × arm × model/provider × repetition`

三臂是部署策略 bundle：

- `visual`：仅 screenshot 的 CUA；
- `hybrid`：screenshot 加 allow-listed accessibility/page structure；
- `playwright`：固定的 accessibility-first locator 脚本。

这意味着主比较估计的是完整部署策略的条件化差异，而不是把所有差异错误归结为单一“视觉模态效应”。如果需要识别 observation modality 的机制，应在同一模型、prompt、action schema 和预算下另设 nested visual-versus-hybrid diagnostic。

### 3.2 结果定义

独立 evaluator 的任务 postcondition 与 agent 自报 verdict 分开记录。当前代码区分：

- `task_state_reached` / `checkpoint_reached`；
- `protocol_completed`；
- `oracle_only_success`；
- `cell_passed`，即任务状态达到、协议正确结束且独立 oracle 通过；
- provider、grounding、step-budget、termination、oracle 等 failure category。

这与研究目标一致：不能因为页面最终存在就把一个超时的 agent 记为成功，也不能因为 agent 发出 `pass` 就替代独立 oracle。

## 4. 当前真实 pilot 证据

所有数据均为 feasibility/pilot。模型/provider strata 没有合并，旧协议标签和新协议标签也不能直接合并。

| SUT / task / condition | Playwright | Pure visual | Hybrid | 当前解释 |
|---|---:|---:|---:|---|
| BookStack create-page clean，Alibaba/Qwen，3 reps | 3/3 | strict 0/3；task oracle 3/3 | 3/3 | Qwen visual 存在 termination/grounding 不稳定，不能算三臂 admission |
| BookStack create-page clean，Volcengine/Doubao，3 reps | 3/3 | 3/3 | 3/3 | 一个 clean task 的可运行 matched pilot；不支持全局 winner 或等价结论 |
| Indico create-event clean，Volcengine/Doubao，1 rep | 1/1 | 0/1 | 0/1 | 两个 CUA arm 到 14-step budget，未创建 oracle-visible event；reset/auth 通过 |
| Juice Shop product-search clean，Volcengine/Doubao，1 rep | 1/1 | 0/1 | 0/1 | visual 发出 pass 但独立 UI oracle 未通过，hybrid 在 provider timeout 前无动作 |
| Juice Shop watchdog/oracle-poll rerun，Volcengine/Doubao，1 rep | 1/1 | 0/1 | 0/1 | 独立隔离的失败复核；不能替代主 pilot，也不能放宽 oracle |

BookStack Qwen 失败边界是：两次 `agent-step-budget` 且 oracle-only success，一次 `grounding-loop`。Indico 两个 CUA 运行均为 step-budget。Juice Shop 的一次 visual 是 oracle failure，后续隔离重跑 visual/hybrid 进入 provider timeout。上述失败均应保留在分母和 failure taxonomy 中。

## 5. 各阶段状态

| 阶段 | 状态 | 证据与尚缺内容 |
|---|---|---|
| Phase 0 项目与 public boundary | **PASS** | GitHub public 实验仓库、Node/Playwright、schema、README、`.env`/artifacts ignore 均已建立；未发现论文源码或 key 被跟踪 |
| Phase 1 文献、冲突边界、研究冻结 | **PASS** | 近邻工作精读、冲突审计、bounded-claim GO；不再声称“首次 CUA vs Playwright” |
| Phase 2 SUT/lifecycle/oracle | **PARTIAL** | BookStack、Indico、Juice Shop 生命周期、reset、传统 baseline、独立 oracle 和 mutation harness 已有实现；hostname、镜像/VM 和服务并行运行仍需协议化 |
| Phase 2 三臂 clean admission | **PARTIAL** | BookStack 仅 Doubao stratum 的单任务 clean pilot 达到 3/3/arm；Qwen visual 未达 strict gate；Indico/Juice CUA 未达 gate |
| Phase 2 fault/evolution | **PARTIAL** | BookStack 与 Indico/Juice mutation harness、契约和 live gate 证据已有；Indico/Juice 的三臂 fault/evolution agent blocks 尚未采集 |
| Phase 3 benchmark breadth | **OPEN** | 当前每个 SUT 只有一个真正运行过的 vertical-slice task；其余 12 个候选 workflow 尚未完成 oracle、fixture、reset 和三臂 admission |
| Phase 4 unified harness/ledger | **PARTIAL** | visual/hybrid/Playwright 均有 runner，contracts 与 collector 通过；代表性 ledger 可审计，但旧产物存在不同协议标签，Playwright 与 agent 的全矩阵 ledger 尚未冻结为单一 confirmatory入口 |
| Phase 5 pilot variance/cost/power | **OPEN** | 有少量 latency/retry/failure 数据；token/cost 多为 null；此前 power 输出为 planning simulation，不是最终样本量决定 |
| Phase 6 preregistration freeze | **OPEN** | 任务矩阵、模型 strata、MDE、repetition、budget、缺失规则和 repair protocol 仍未最终冻结或注册 |
| Phase 7 confirmatory collection | **NOT STARTED** | admission、power 和 preregistration 前置条件未满足 |
| Phase 8–9 analysis/paper/artifact | **OPEN/PARTIAL** | 指标、分析草案、论文骨架和 public harness 已有；没有 confirmatory effect estimate、最终图表或 clean-room replication |

## 6. 工程与证据质量审计

### 已通过

- pure-visual observation contract 拒绝 DOM/accessibility/page structure 泄漏；
- hybrid contract 递归拒绝 nested hidden oracle/application state/mutation fields；
- visual/hybrid driver 对 screenshot 状态变化和重复坐标有明确的 progress guard；
- provider wall-time budget、失败分类和 oracle-independent outcome admission 已实现；
- BookStack visible/persisted oracle、Indico PostgreSQL oracle、Juice Shop visible UI oracle 有独立契约测试；
- Indico transactional fault 与 Juice Shop omission/layout mutation 已有 apply/remove/isolation 设计；
- run record 保留 status、checkpoint、verdict、timing、retry、model/provider provenance 和 SHA-256 trace hash，且不落盘原始 trace、key 或密码；
- public repository 当前未跟踪 `code/.env`、`code/.env.doubao`、`artifacts/`、`paper/` 或第三方 checkout。

### 必须标记为部分完成

1. 早期 artifact 在 provider 在 adapter 返回前失败时记录了 `wall_time_ms: 0`。当前代码已有 elapsed-time fallback，但需要一次新版本真实失败重跑验证，旧记录不得回写或修饰。
2. provider 不一定返回可靠 token/billing usage，因此 `tokens` 与 `cost_usd` 不能按零处理；成本比较必须报告 unavailableness，并预先决定是否使用 wall-time/action/retry 作为可比的 resource outcomes。
3. `check:sut` 在没有显式 `SUT_BASE_URL` 时会返回 not-configured，即使某个服务实际可达。运行说明必须要求显式 URL 或 lifecycle profile，避免 readiness false negative。
4. 当前三个 SUT 容器可以同时运行，BookStack、Indico 与 Juice Shop 的端口和 hostname 规则不同。confirmatory harness 需要单一 profile、端口 ownership 检查和按 block 的 start/reset/stop，防止跨 SUT 污染。
5. 传统主 baseline 目前是 accessibility-first Playwright。Selenium、legacy CSS/XPath、state-model 和 script-generation baselines 仍是 exploratory/planned，不能在论文中写成已完成的“传统方法全集”。
6. 当前 run-record 的 trace 只有不可逆 hash，适合 public ledger provenance；受控 private audit 仍需保存加密或权限隔离的原始 trace location/retention policy，不能依靠 hash 重建 action-level failure analysis。

## 7. 与科研目标的正确解释

当前证据已经支持的表述：

- 我们建立了一个可复位、独立 oracle 评分、三臂 observation contract 隔离的 Web testing vertical slice；
- CUA 的可行性和稳定性明显依赖 model/provider 与任务，而非只由“CUA”这一标签决定；
- 在 BookStack create-page clean task 上，Doubao stratum 的 visual、hybrid、Playwright 均完成，而 Qwen visual 出现 oracle-only/grounding failures；这是一个 model × task 条件化现象；
- Indico/Juice Shop 的当前失败提供了 provider latency、step-budget、grounding 和 oracle-disagreement 的 failure-mode evidence，但不是传统测试优越性的 confirmatory 证明；
- 独立 oracle、strict termination 和 failure-preserving denominator 是必要的测量设计，否则会把“页面最终存在”误报为 agent 成功。

当前证据不支持的表述：

- “CUA 普遍优于/劣于 Playwright”；
- “hybrid 普遍最好”或“三臂等价”；
- “Qwen/Doubao 的一个 pilot 比较代表所有视觉模型”；
- “Indico/Juice Shop 已完成三臂 benchmark”；
- “power 已足够”或“可以开始 confirmatory collection”；
- “mutation harness live gate 通过”等同于 agent fault/evolution 实验已经完成。

## 8. 建议的下一步决策顺序

1. **先做观测链复核**：用当前 runner 重跑一个预先指定的 provider-failure case，确认 wall-time fallback、failure category 和 JSONL ledger 不再出现零时长伪影；不修改旧数据。
2. **冻结一个最小 pilot protocol，而非冻结最终样本量**：固定 viewport、browser/channel、model/provider、prompt、step/time budget、retry、reset profile 和 run tag；按 provider/model 分层保存。
3. **BookStack 继续做 task-family admission**：先完成低复杂度导航、编辑/搜索等任务的 clean three-arm pilot，再决定是否把 Doubao 作为主可执行 stratum、Qwen 作为 failure/replication stratum。不得根据结果删除困难任务。
4. **只有在每个目标 stratum 至少有一个稳定 clean task-condition block 后**，才在 Indico/Juice Shop 做 fault/evolution agent blocks；mutation apply/remove/isolation 需与每个 block 绑定。
5. **扩展 benchmark breadth**：每个 SUT 从单任务扩展到 CRUD、search/filter、multi-step form、跨页/关系状态和权限任务；每个新增任务先过 reset、传统 oracle、负例和 evolution invariant gate。
6. **收集 pilot variance 后做 power simulation**：以 task-level paired outcomes、模型/provider 分层和预先说明的 MDE 为输入，冻结 repetitions、交互项、Holm 校正和 repair censoring；此前 planning JSON 仅作方法开发记录。
7. **完成 preregistration 冻结后才启动 confirmatory ledger**：confirmatory runner 必须拒绝未冻结的 task/mutation/model/prompt/version；任何 provider 更新或协议改动写入 deviation log。

因此，当前项目不是停滞，而是已经从“能否运行”进入“能否跨任务稳定、可统计地比较”的关键阶段。科研主线应继续围绕条件化表现曲面：CUA 何时受益于视觉自由度，传统 locator 何时受益于确定性状态绑定，hybrid 何时真正减少 grounding/maintenance 代价，以及模型/provider、oracle 和 UI 演化如何改变这些边界。
