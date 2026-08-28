# PSS-WebTest 科研项目概括汇报稿

适用场景：组会、开题交流、项目阶段汇报

建议时长：8–10 分钟

## 一、开场：我们究竟想研究什么

大家好，我今天介绍的项目叫作 PSS-WebTest。项目关注的是一个正在快速出现、但目前还缺少系统实证回答的问题：当我们使用 Computer-Using Agent，也就是能够通过截图理解界面并执行点击、输入、滚动等操作的智能体，来完成 Web UI testing 时，它和传统的 locator-based 测试方法相比，到底有什么不同？

这里我想先强调一点：我们的目标从来不是预先证明 CUA 一定比传统测试好，也不是寻找一个对所有 Web 应用都最优的方法。我们真正想回答的是一个条件化问题：在什么样的 Web UI、什么样的测试任务、什么样的 test oracle、什么样的功能缺陷或界面演化条件下，纯视觉 CUA 更有优势，传统 Playwright 更有优势，而视觉和结构信息结合的 hybrid 方法又可能更合适？

因此，这项工作本质上不是一个简单的排行榜，而是一个 decision-boundary study。最终希望得到的是一张“适用边界图”：面对一个具体的 Web 测试场景，研究者或工程师可以判断应该优先采用视觉智能体、混合智能体，还是确定性的传统测试脚本。

## 二、为什么这个问题重要

传统 Web 自动化测试通常依赖 DOM、accessibility tree、role、label、test id 或其他 locator。它的优点是确定性强、执行速度快、结果容易复现，也比较适合验证明确的状态和数据。但是，它往往依赖开发者预先提供稳定的结构和定位信息。当页面结构、组件层次、命名方式或者布局发生变化时，脚本可能需要人工维护。

纯视觉 CUA 的思路相反。它主要看浏览器截图，通过视觉理解页面，然后用坐标、键盘和滚动完成操作。它可能更接近真实用户，也可能更能适应没有稳定 locator 的界面。但它同时面临视觉 grounding、坐标选择、重复操作、长链路规划、模型延迟和重复运行不稳定等问题。

Hybrid 方法处于两者之间。它同时接收截图和经过明确限制的页面结构，例如元素 role、name、state 和稳定的 harness reference。它希望保留视觉灵活性，同时减少纯视觉定位的困难。不过，它也可能继承结构变化带来的脆弱性。

真正困难的地方在于，这三种方法不只是观察信息不同，它们的 action interface、运行时适应方式、测试 artifact 形式和维护方式也不同。因此，我们不能只做一个“截图输入 versus DOM 输入”的小实验，而需要比较完整的 testing strategy bundle。

## 三、核心实验设计：三个测试臂

我们的实验保留三个主要 testing arms。

第一是 pure-visual CUA。它只接收自然语言任务意图和截图，不接收 DOM、accessibility tree、selector、数据库状态、网络状态或 hidden oracle。它可以执行受限的点击、输入、键盘和滚动操作。

第二是 hybrid visual-plus-structure agent。它接收同样的任务意图和截图，另外接收 allow-listed 的 page structure。这个结构只包含允许暴露给智能体的页面信息，不能包含数据库结果、mutation label、gold oracle 或应用内部状态。我们已经为这个边界实现了递归 anti-leakage contract，连嵌套字段也会检查。

第三是传统 accessibility-locator Playwright。它是当前的主要传统 baseline，由固定脚本使用 role、label、text 或合理的 test id 执行操作，并通过明确的状态断言判断结果。我们没有把传统方法故意写成脆弱的 CSS 或 XPath 脚本，因为研究应该比较一个有代表性的工程 baseline，而不是比较一个被削弱的对照组。Selenium、legacy CSS/XPath 和 state-model testing 可以作为后续 exploratory baselines，但目前不能说已经全部完成。

## 四、匹配实验和场景因素

每一个实验单位可以表示为：

`application × task × condition × arm × model/provider × repetition`。

这里的 matched 意思是，三个测试臂使用同一个自然语言任务意图、同一个初始状态、同一个浏览器 viewport、同一个版本、同一个条件、同一个独立 oracle 和相同的预算。每个 arm 都要单独 reset，不能因为前一个 arm 修改了数据库就影响后一个 arm。

当前的三个本地 self-hosted SUT，也就是 systems under test，分别是 BookStack、Indico 和 OWASP Juice Shop。

BookStack 的示例任务是：进入指定的 Book，在其中创建一篇页面，填写标题和正文，保存后离开页面再回来，最后由独立数据库 oracle 验证标题、正文和所属关系是否持久化。

Indico 的示例任务是：登录系统，创建一个具有固定标题和日期的事件，发布它，再由独立 PostgreSQL oracle 检查事件是否确实存在、字段是否匹配、公开页面是否一致。

Juice Shop 的示例任务是：在产品目录中搜索固定关键词，检查搜索路由、输入框、结果卡片和负控制项，同时由独立 UI evaluator 和 REST 查询检查结果是否正确。

除了 clean stable 条件，我们还设计了两类重要变化。

第一类是 functional fault，也就是预先注入的功能缺陷。例如持久化数据被修改、搜索结果遗漏、事件字段不一致。它用于测量测试方法能否发现问题，以及 oracle 是否正确。

第二类是 behavior-preserving UI evolution，也就是业务语义保持不变，但 DOM 层次、布局、命名方式、异步时序或视觉呈现发生变化。它用于观察测试脚本和智能体的脆弱性、恢复能力和修复成本。功能缺陷与 UI 演化必须分开分析，因为界面改变并不自动意味着软件出现了 bug。

## 五、为什么必须使用独立 oracle

在这个项目里，oracle 不是智能体自己说“我成功了”就算成功。Oracle 指的是独立的结果判断机制。

例如，智能体可能已经把页面创建出来，但最后因为没有及时发出正确的终止 verdict 而超时。我们会把它记录为 `oracle_only_success`，而不是把它记成严格成功。反过来，智能体可能发出了 pass，但搜索结果并不正确，这种情况也不能算成功。

因此，我们把结果拆成几个层次：任务状态是否达到，协议是否正确结束，独立 oracle 是否通过，agent verdict 是否正确，以及最终 cell 是否同时满足这些条件。这样可以区分 provider failure、grounding loop、step-budget、oracle disagreement 和真实测试失败。

这也是为什么我们的主要结果不会只有一个 success rate。我们还会报告 verdict correctness、false-positive rate、false-negative rate、latency、action count、retry rate、运行稳定性、repair success 和 active repair time。

## 六、当前已经完成到什么程度

目前项目已经从概念设计进入可审计的 Phase 2 feasibility/admission pilot 阶段，但还没有开始 confirmatory collection。

工程方面，三臂 runner、observation contract、hybrid anti-leakage、独立 UI/数据库 oracle、fault/evolution harness、failure taxonomy 和标准 run-record ledger 都已经实现。当前契约测试 50 项全部通过，manifest、benchmark matrix 和 study asset validation 也全部通过。

实验方面，BookStack 的结果必须按模型分层解释。Alibaba-compatible 的 Qwen3-VL-Flash 在 create-page clean task 上，Playwright 是 3/3，hybrid 是 3/3，pure visual 的严格 cell success 是 0/3，但三次都达到 persisted task oracle，主要问题是 step budget 和 grounding loop。Volcengine Ark 的 Doubao Seed 2.0 Pro 在同一个 BookStack clean task 上，三臂都是 3/3。

这说明一个很重要的事实：CUA 的表现不仅取决于“是不是 CUA”，还取决于具体的 model/provider、任务结构和终止协议。Doubao 在一个 BookStack clean task 上能够稳定运行，并不意味着它在所有 Web 测试任务上都稳定，更不能把两个模型的结果合并成一个 CUA 结论。

Indico 当前完成的是一个真实的一次性 matched feasibility pilot：Playwright 1/1，visual 0/1，hybrid 0/1。两个 CUA arm 都在 14-step budget 内没有完成独立 oracle 可见的事件创建。Juice Shop 也是 Playwright 1/1，而 visual 和 hybrid 尚未通过 clean admission。Indico 和 Juice Shop 的失败目前主要表现为 step budget、provider timeout 和 oracle disagreement，而不是 reset 基础设施失败。

所以，当前结果可以支持“不同模型和任务下出现了不同的失败边界”这一观察，但不能支持“CUA 普遍好于或差于传统测试”的结论。

## 七、后续实验流程

我们的后续顺序是严格的。

首先，验证新版 runner 在 provider 早期失败时能否正确记录 wall time、failure category 和 run record，避免早期 artifact 中出现零时长记录。

其次，在 BookStack 继续扩展 clean task family，例如导航、编辑、搜索和跨页面状态任务，先形成至少一个稳定的三臂任务条件 block。这里不能只保留容易成功的任务，困难任务的失败也是研究对象。

第三，在 clean admission 通过后，才把 fault/evolution agent blocks 扩展到 Indico 和 Juice Shop，并且为每个条件执行 apply、independent oracle、remove 和 isolation gate。

第四，增加更多 workflow 和必要的模型 replication。每个新增任务都必须有确定性 reset、独立 oracle、正反例和 mutation invariant。

第五，使用 pilot 中的 task-level paired outcomes、模型分层和失败方差进行 power simulation，冻结 repetition、最小实际重要差异、交互项和缺失规则。

最后，完成 preregistration 后才开始 confirmatory collection，并从冻结的 append-only ledger 自动生成统计结果、表格和图形。

## 八、项目价值和预期贡献

我们希望贡献的不是一句“某种方法更好”，而是四类可复用成果。

第一，一个有 matched intents、独立 oracle、功能缺陷、行为保持 UI 演化和重复运行机制的 Web testing benchmark。

第二，一个对三种 testing strategy 统一评分的实验框架，同时严格隔离 visual、hybrid 和传统脚本能够看到的信息。

第三，一套能够区分任务完成、verdict correctness、provider failure、grounding failure、维护工作量和运行成本的 measurement protocol。

第四，一张具有实践意义的适用边界图：在稳定且结构清晰的页面上，传统 locator 测试可能更有优势；在视觉布局变化或 locator 不稳定的场景中，纯视觉 CUA 可能体现灵活性；在页面结构可获得、任务又需要视觉判断时，hybrid 可能减少 grounding 成本。最终哪一种情况成立，必须由冻结协议后的数据来回答，而不是由预设观点决定。

## 九、结束语

总结来说，PSS-WebTest 研究的不是“CUA 是否取代传统测试”，而是“不同测试策略在什么条件下适合什么任务”。当前我们已经完成了研究边界、三臂设计、独立 oracle、SUT 生命周期、实验契约和初步真实 pilot，但还没有进入最终统计结论阶段。

下一步的关键是扩大任务和条件，同时保持严格的 reset、oracle、run-record 和 admission gate。只有这样，我们最终才能比较的不只是成功次数，还包括谁在什么场景下更可靠、谁更容易维护、谁成本更低、谁更能适应 UI 演化，以及三者在真实 Web 软件测试中如何互补。

谢谢大家。

## 附：可能被追问的概念和回答

### 1. CUA 是什么？

CUA 是 Computer-Using Agent，指能够通过视觉或结构化页面信息理解计算机界面，并执行点击、输入、滚动等操作的智能体。本项目中的 pure-visual CUA 只使用截图，hybrid CUA 额外使用受限的页面结构。

### 2. SUT 是什么？

SUT 是 System Under Test，即被测试的软件系统。本项目选择可以本地部署、版本固定、自动 reset 并且有独立 oracle 的开源 Web 应用。

### 3. Test oracle 是什么？

Test oracle 是判断测试结果是否正确的独立依据。例如数据库记录、跨页面关系、可见路由和结果卡片。它不能简单等同于 agent 自报的 pass。

### 4. 为什么要做 matched？

Matched 表示三个 arm 面对同一个任务意图、同一个初始状态和同一个测试条件。这样比较才不会因为任务难度不同而产生系统性偏差。

### 5. 为什么不只比较成功率？

因为成功率会掩盖很多重要差异。一个方法可能完成率高，但延迟和维护成本高；另一个方法可能偶尔失败，但在 UI 演化后更容易修复。因此我们同时记录有效完成、oracle 正确性、误报漏报、延迟、成本、重复稳定性和修复工作量。

### 6. 当前能不能说哪种方法最好？

不能。当前数据是 feasibility/pilot，不是 confirmatory evidence。我们只能说已经观察到明显的 model × task × arm 交互和不同失败模式，最终的适用边界需要更多任务、条件和重复运行来估计。
