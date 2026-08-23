# PSS-WebTest Benchmark 扩展蓝图 v0.1

更新时间：2026-08-23

## 1. 研究目标重新确认

本项目从一开始就不是为了证明 CUA、传统 locator-based testing 或 hybrid testing 中存在一个普遍最优者。目标是估计：

> 在不同 Web UI 结构、任务类型、oracle authority、功能缺陷、UI 演化、模型/provider 和运行预算下，pure-visual CUA、hybrid visual+structure agent、传统自动化测试方法分别在什么条件下表现更好、更差或具有互补性。

因此，最终 benchmark 的对象不是单一 leaderboard，而是一个可复现的条件化数据集和实验框架：

```text
SUT × workflow × oracle × fault/evolution condition
  × testing strategy × CUA model/provider × repetition
```

所有结论都必须保留 raw denominator、failure category、oracle authority 和 model provenance。

## 2. Benchmark 的三层因素

### 2.1 Testing strategy layer

主比较保留三臂：

1. **Pure visual CUA**：截图-only，坐标/键盘/滚动 action。
2. **Hybrid CUA**：截图 + declared accessibility/page structure。
3. **Traditional locator suite**：人类编写的 accessibility-first Playwright suite。

第三臂不是故意削弱的 CSS/XPath baseline，而应代表当前良好实践。

### 2.2 Model/provider layer

至少分为两个阶段：

- **主 pilot**：固定一个真实可用的视觉模型，当前为 `qwen3-vl-flash`，先冻结 runner、schema、prompt 和预算。
- **跨模型 replication stratum**：在主协议冻结后，加入至少两个支持图像输入的多模态模型/provider。模型切换不得修改 task、oracle、mutation、预算和 run-record schema。

模型不是简单地与 arm 混为一个变量。对于 visual 与 hybrid，优先使用同一模型的两种 observation contract；跨模型结果作为 replication/moderator stratum，并报告 `strategy × model` 交互。

### 2.3 Traditional-method layer

在 accessibility-first Playwright 主 baseline 之外，可按预算增加：

- Playwright CSS/XPath legacy locator baseline，用于维护成本和 UI 演化诊断；
- Selenium/WebDriver deterministic suite，用于跨工具复核；
- model-based/state-based Web testing baseline，用于有显式状态模型的任务；
- script-generation-then-execution baseline，仅作为 exploratory，不替代三臂主比较。

这些方法必须以版本化工具和同一独立 oracle 运行，不能把传统方法笼统合并成一个数字。

## 3. 数据集维度

### SUT 维度

当前三个 SUT 是第一批：BookStack、Indico、Juice Shop。目标扩展为 3–4 个不同 UI 风格和业务类型的 self-hosted SUT，第四个候选只有在 license、reset、oracle 和运行预算均通过后加入。

### Workflow 维度

每个 SUT 的目标不是一个 demo task，而是覆盖：

- CRUD/persistence；
- multi-step form；
- search/filter；
- role/permission；
- cross-page state；
- data-dependent or relational workflow。

第一版可设为每个 SUT 4–6 个 workflow 候选，但最终 confirmatory 数量由 power 和预算共同决定。

### Oracle 维度

每个 workflow 至少定义一种主要 independent oracle，并尽量形成分层：

- visible UI postcondition；
- persisted database state；
- relational/cross-page consistency；
- clean/fault verdict；
- visual/usability oracle（只有在 blinded rater protocol 和 reliability threshold 冻结后才进入 confirmatory）。

Agent 的 self-reported verdict 永远不是 ground truth。

### Condition 维度

每个候选 workflow 至少考虑：

- clean stable；
- functional fault；
- DOM-preserving evolution；
- accessibility-semantic evolution；
- visual/layout evolution；
- runtime/asynchronous evolution。

modality-adversarial stress probe 单独标记，不与 ecological evolution 混合，也不用于泛化 prevalence claim。

## 4. 每条 benchmark record 应包含什么

每个 `application × workflow × condition × strategy × model × repetition` 记录至少包含：

- SUT version/image digest/architecture；
- task intent、fixture、reset hash；
- arm/strategy、model/provider、prompt/action schema version；
- observation contract；
- action/observation trace hash；
- valid completion；
- emitted verdict 和 independent verdict；
- oracle authority；
- latency、actions、retries、tokens/cost（可得时）；
- repair success、active person-minutes、edit size；
- failure category、censoring reason、environment status；
- mutation/fault ID 和 invariant-check result。

## 5. 两阶段 benchmark 构建顺序

### Stage A：vertical-slice expansion

1. 固定当前 Qwen provider 的 BookStack 3×3 clean pilot harness。
2. 统一 Playwright、visual、hybrid 三臂的 run-record schema。
3. 在 BookStack 完成至少一个 fault、一个 layout evolution 和一个 repair slice。
4. 在 Indico/Juice Shop 先完成 clean agent admission，再运行 fault/evolution agent blocks。
5. 通过这些条件估计 grounding、reset、oracle 和 provider failure variance。

### Stage B：benchmark breadth and model replication

1. 为每个 SUT 增加 workflow，而不是立即增加 repetitions。
2. 选择第二、第三个视觉模型/provider，保持协议不变。
3. 增加传统 locator/Selenium/state-model diagnostics。
4. 对所有新增任务执行 clean/fault/evolution invariant gate。
5. 基于完整 pilot 冻结 MDE、repetitions、budget、missingness 和 power。
6. 冻结 preregistration 后再开始 confirmatory collection。

## 6. 研究解释规则

- CUA 在视觉/layout evolution 下更好，而 Playwright 在稳定 DOM/persistence 任务下更好：这是目标结果。
- Hybrid 只有在结构信息确实减少 grounding failure 时才可称为互补；仅仅“看到了 accessibility tree”不算效果。
- 某模型失败不能直接等同于 CUA 范式失败，必须保留 model/provider 维度。
- 某个传统工具失败不能直接等同于传统测试失败，必须报告 locator policy 和 tool implementation。
- 负结果、floor effect、provider outage 和 infrastructure error 必须分开记录。
- 没有足够跨任务/跨模型/跨条件的数据时，只报告适用边界和可行性，不报告普遍 superiority/equivalence。

