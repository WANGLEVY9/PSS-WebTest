# Phase 2 progress log — 2026-08-18

本记录承接 [`phase2-progress-2026-08-16.md`](phase2-progress-2026-08-16.md)，只记录本轮新增的可行性证据；所有结果仍然是 feasibility/smoke evidence，不是 confirmatory study results。

## 1. Indico vertical slice

- 在干净 reset 后，使用仅存在于当前进程环境变量中的本地 seed 测试账号运行 accessibility-first Playwright create-event workflow，成功创建标题为 `PSS Phase2 Event`、日期为 2030-01-15 的 lecture event，并进入管理页面。
- 新增独立 PostgreSQL oracle：检查 `events.events` 中恰好一条匹配记录，要求标题、开始/结束日期、lecture 类型、未删除、creator、Home category 和 public/inheriting protection 条件同时满足。
- Playwright slice 和 oracle 均通过。
- 发现的 reset 风险：Compose 同时启动共享 `static-files` volume 的 Web/Celery/Celery Beat/Nginx 时会在 Colima 上出现 `.../dist: file exists` 并发初始化冲突。生命周期脚本现已改成 PostgreSQL/Redis → Web（等待 uWSGI）→ Celery/Celery Beat/Nginx 的串行启动；修复后 reset 成功，最新周期 HTTP 200 就绪 11,108 ms、完整 seed/校验 15,182 ms，自动确认 18 个 events。
- `indico populate` 在 3.3.6 镜像中已不存在，但启动脚本继续执行 `indico db prepare`，随后本项目 seed SQL 成功导入；该兼容性警告仍保留在审计中。

## 2. OWASP Juice Shop vertical slice

- 使用固定的 `bkimminich/juice-shop:v20.0.0` arm64 镜像，在弹窗和 cookie 提示处理后，完成 accessibility-first product-search workflow。
- `q=apple` 的 UI 结果验证了 `Apple Juice (1000ml)`、`Apple Pomace` 和 `Pineapple Juice (1000ml)`，并确认 `Banana Juice (1000ml)` 不在结果中。
- 新增独立 REST oracle，在浏览器轨迹之外检查 API 返回的三个固定产品名称和顺序；oracle 通过。
- Juice Shop v20 的搜索框没有可访问名称，只能使用 role-based unnamed textbox；这被保留为被测 UI 的可访问性限制，不通过 CSS selector 隐藏。
- 首次运行的 Welcome 与 cookie overlay 会阻塞交互；测试显式处理并记录这一环境前置状态。

## 3. 账号与 public-repository 边界

- 移除了 BookStack 测试文件中已提交的默认密码硬编码；BookStack 与 Indico 均改为要求 `PSS_BOOKSTACK_USERNAME/PSS_BOOKSTACK_PASSWORD`、`PSS_INDICO_USERNAME/PSS_INDICO_PASSWORD` 本地环境变量。
- `.env.example` 只包含变量名和占位符，不包含可用密码；测试通过当前进程环境变量运行后，public-boundary 检查通过。
- 这意味着后续本地复现需要填入 seed 测试账号，但不需要外部模型 API key 才能运行三套传统 Playwright/oracle slice。

## 4. Agent adapter 与 Volcengine provider smoke evidence

- 新增 provider-neutral agent adapter：visual/hybrid arm 在每一步调用 observation contract，拒绝结构化信息泄漏，并记录 action、step、observation contract、wall time 和 verdict 状态。
- 新增 `npm run check:agent` readiness gate。该脚本读取进程环境变量，因此本地运行前需 `source code/.env`；它不会打印 key。

```json
{"status":"configured","provider":"volcengine","model":"doubao-seed-2-0-pro-260215","api_key_present":true}
```

- adapter contract tests 与 observation tests 以及 Volcengine driver tests 共 12/12 通过；contract-only driver 不计作 Agent 实验结果。
- 新增 `src/arms/volcengine-cua-driver.mjs`：通过 OpenAI-compatible `/chat/completions` 接口发送截图，要求模型返回受限 JSON action/done schema；driver 不接收 DOM，符合 pure-visual contract。
- 真实 provider smoke：文本请求 HTTP 200；图片输入 HTTP 200；修复 key 读取 bug 后，真实结构化决策返回 `{"type":"done","verdict":"pass"}`。该结果只证明 provider/driver 可用，不是任务成功率或论文实验结果。
- 在本地 Juice Shop 1280×720 视口上运行了最多 3 步的真实 pure-visual 浏览器 smoke：模型返回了 3 个 click，轨迹被完整记录，但未在步数上限内完成搜索；其中一次返回坐标 `y=923` 超出视口，runner 现已加入坐标边界保护并将此类动作视为失败。该失败是 feasibility evidence，不能当作任务通过。
- 后续 4-step pilot 中模型完成了两次 click 后返回非 JSON，runner 结构化记录 `failure=CUA model did not return valid JSON` 并保留前两步轨迹；这暴露了 provider 输出稳定性问题。driver 现加入 `response_format: {type: "json_object"}` 约束，合约测试和合成图片真实请求仍通过；该改动尚未证明真实任务成功率提升。
- 在加入 JSON 约束和 Volcengine 的 0–1000 相对坐标转换后，重复 4-step pilot 的四个 click 均落在 1280×720 视口内，但仍未完成搜索（`status=timeout`）。这降低了坐标越界错误，却显示 grounding/页面状态处理仍是主要问题；不能把可见产品 marker 当作 agent 成功，因为它来自初始页面内容。
- 固定搜索框前置状态 pilot 进一步隔离了导航因素：模型第一步成功输出并执行 `type("apple")`，随后连续点击但未提交搜索，3 步后 timeout。该结果表明输入 grounding 已部分工作，提交动作选择/状态确认仍失败；同时暴露的缺字段 schema 问题已通过更严格的动作格式提示修复。
- 在窄化的 `submit-only` 条件中，fixture 预填充 `apple` 并打开搜索框，模型一步返回 `keypress(ENTER)`；runner 将模型大写键名规范化为 Playwright `Enter` 后执行成功，agent verdict 为 `pass`。随后独立 Juice Shop REST oracle 返回三个预期产品且 `passed=true`。这只是固定前置状态下的 feasibility slice，不代表完整导航任务成功率。
- 针对先前“REST oracle 通过但可见产品可能来自初始页面”的因果性风险，新增 `visible-ui-search-postcondition`：独立 evaluator 在 agent 轨迹结束后，仅从浏览器可见状态检查搜索路由包含 `apple`、搜索框值、三个预期结果卡片和负控制 `Banana Juice (1000ml)` 不可见；不调用 REST API，也不读取模型 verdict。初始 `/home` 页面即使包含产品标记也会被该 oracle 拒绝。当前完整视觉任务仍需在该 UI oracle 下成功后才可计为 post-condition pass；`submit-only` 仍只作固定前置 feasibility slice。
- 通过一次真实 Juice Shop 页面上的传统可控流程复核了该 UI oracle：实际 URL `#/search?q=apple`、textbox 值、三个正向卡片和负控制均符合预期，`passed=true`。因此 oracle 的 live DOM 语义已验证；它仍只作为 evaluator 侧证据，不注入 agent observation。
- key 只从本地进程环境读取，不进入返回对象、日志或仓库。
- hybrid provider 最小 driver 已实现：发送 screenshot + 声明的 pageStructure，先经 hybrid contract 检查并拒绝嵌套 hidden fields；真实 Juice Shop/BookStack invocation 已执行，但 provider timeout/AbortError 使任务 oracle 未通过。
- 新增标准 run-record 基础设施：schema-compatible immutable record、SHA-256 trace hash、failure category、provenance、敏感字段拒绝和 JSONL batch collector；目前只完成 contract/CLI evidence，尚未将完整 confirmatory runner 批量接入。
- 新增 Indico reversible PostgreSQL fault harness、Juice Shop omission/layout mutations 和 Indico layout mutation contracts；apply/remove/clean/isolation 的 live Docker gate 仍待执行。
- Juice Shop live mutation gate 已通过：clean visible-ui oracle `passed=true`；page-local omission fault 移除 `Apple Pomace` 且 oracle `passed=false`；page-local layout-v1 保持 oracle `passed=true`。三者使用隔离 Playwright pages，mutation 不写入 SUT 容器。
- Indico live fault trigger gate 已通过 apply/transactional observation/rollback/remove/isolation：触发器将精确匹配的 `PSS Phase2 Event` 改写为 `[FAULT]`，事务回滚后无持久化副作用，remove 后 PostgreSQL trigger count 为 0。
- BookStack 传统 baseline 已使用本地 seed 账号完成 3/3 clean reset → accessibility Playwright → persisted DB oracle reliability pilot；artifact 写入 gitignored `artifacts/phase2/bookstack-reliability-pilot.json`。
- 新增 BookStack 三臂 matched runner；最新完整 artifact 是 1 repetition × 3 arms：三个 reset/clean-state gate 均通过，Playwright 1/1 通过，visual 在两次导航动作后 provider abort，hybrid 在一步后 timeout。reset 根因已修复（MySQL temporary-server race + stale volume），当前 blocker 已收窄为 provider/agent reliability；尚未达到 matched-pilot admission gate。
- 新增 pilot power-planning simulation；仅使用 `reset_ok=true` 行并作 Jeffreys smoothing，输出仍标记 `confirmatory=false`，不冻结最终 repetition 数。

## 4.1 自检修正（2026-08-18）

- 本地 Indico 实验账号 `pss_phase2_indico`（ID 2）已配置在被忽略的 `code/.env`，clean 登录 → 创建事件 workflow 通过，独立 PostgreSQL oracle 现返回 `matches=1, passed=true`。
- 自检发现 oracle 原先硬编码 `creator_id=1`，会将该账号创建的有效事件误判为失败；已改为按 `PSS_INDICO_EMAIL`（默认实验邮箱）解析 `users.emails` 中的 user ID，并重新通过 oracle 与 27/27 契约测试。
- Indico fault trigger 当前已移除（live PostgreSQL trigger count=0）。在 fault 已应用时，clean-title Playwright 断言失败属于预期的故障可见性证据，不作为独立 fault oracle。
- 随后新增并运行 `npm run pilot:indico:fault`：隔离旧 fixture 后执行登录 → 创建事件 → trigger 改写标题 → 页面观察 `[FAULT]` → 独立 fault-aware PostgreSQL oracle，结果 `browser_fault_visible=true`、`independent_oracle_detected_fault=true`、`trigger_removed=true`、`passed=true`。该运行器在 finally 中清理 trigger。

## 5. 当前退出判断

| 子门槛 | 状态 |
|---|---|
| 三个候选 SUT deterministic reset | 通过本地 feasibility gate |
| 三个任务级 Playwright slice | 通过本地 feasibility gate |
| 三个独立 task oracle | 通过本地 feasibility gate |
| BookStack functional fault + behavior-preserving UI mutation | 已通过 smoke gate |
| Indico/Juice Shop fault/evolution matrix | live harness gates passed; matched agent blocks not admitted |
| pure-visual provider/driver smoke | 通过 |
| pure-visual real SUT smoke | 已运行但 3-step 试验未完成；存在越界坐标失败 |
| hybrid observation contract / anti-leakage | 通过；已完成真实 Juice Shop/BookStack provider invocation，但独立任务 oracle 均未通过 |
| standard run-record schema/collector | 通过；visual/hybrid/BookStack runner 已生成并校验本地 JSONL records，尚未进入 confirmatory ledger |
| Indico/Juice fault/evolution harness contracts | contract gate 与 live mutation/fault workflow 通过；三臂 agent blocks 尚未 admitted |
| pure-visual/hybrid confirmatory execution | 尚未完成 |
| Phase 2 overall exit | 尚未通过 |

下一步是修复 BookStack reset/服务稳定性并重跑有效 matched pilot；在有效 pilot 达到 admission gate 前，不冻结 confirmatory repetition 或开始 confirmatory collection。

## 6. Provider reconfiguration and connectivity update (2026-08-23)

- The provider configuration was changed locally, without committing credentials, from the previous Ark model to Alibaba Model Studio: `provider=aliyun`, `model=qwen3-vl-flash`, Beijing OpenAI-compatible endpoint. `code/.env` remains gitignored with mode `0600`.
- A real Alibaba API request with a program-generated 32×32 image returned HTTP 200 and a valid response; a JSON-decision request also returned a parseable `done/pass` decision. A 1×1 synthetic image was rejected by the documented minimum image dimension, which is expected and not a provider failure.
- After starting BookStack and passing its HTTP ready gate, the new `npm run provider:bookstack:connectivity` smoke runner sent a real unauthenticated BookStack `/login` screenshot to both arms. Pure visual returned a parseable click action in 1,221 ms with zero retries; hybrid returned a parseable click action from screenshot plus accessibility snapshot in 867 ms with zero retries. No action was executed and no oracle was evaluated.
- This is a provider/input connectivity gate, not evidence of multi-step task reliability. BookStack credentials are still required for an authenticated agent run. The matched-pilot admission gate, repetition freeze, power simulation, and confirmatory collection remain frozen.

## 7. Alibaba Qwen3-VL output hardening and authenticated BookStack recheck (2026-08-23)

- The Alibaba request path now follows the documented Qwen3-VL JSON/tool interface: `enable_thinking=false`, `max_completion_tokens`, and an explicit non-default `presence_penalty=1.5`. Volcengine requests retain their previous `max_tokens`/JSON-object path.
- Because JSON-object mode guarantees valid JSON but not a fixed schema, the Alibaba arm now requests one constrained `ui_action` function call and translates only its whitelisted arguments into the common action schema. Function-call arguments are still validated for action type, coordinate bounds, text length, and single-line text. The visual arm receives only the screenshot; the hybrid arm receives only the screenshot plus the declared page-structure observation. Contract suite: 30/30 passed.
- A real authenticated BookStack diagnostic with qwen3-vl-flash returned HTTP 200 function calls for both visual and hybrid observations. This solved the previous malformed/truncated repeated-newline JSON response, but it is only a provider-output gate.
- The BookStack reset lifecycle now verifies the seed after import (`users=2`, `books=3`, `pages=6`) before admitting an agent cell. This prevents a partially initialized database from being confused with an agent failure.
- Authenticated task rechecks after the seed gate and function-call change were not successful: visual and hybrid could navigate to a new-page editor and issue valid actions, but both failed the independent persisted-state oracle. Representative visual traces either typed title and content into one field or repeatedly clicked the rich-text iframe; representative hybrid traces likewise failed to move from editor focus to a separate content entry and one run timed out after repeated clicks. No run has been promoted to a passed matched cell.
- The hybrid runner includes a declared `editable_regions` page-structure hint for the rich-text iframe, and the prompt records the title→editor-click→content-type transition as a guardrail. These are feasibility interventions only; they do not expose the database oracle or mutation labels. The additional hint did not yet establish hybrid task success.
- At this intermediate point the admission gate remained closed because completed-agent execution plus oracle pass was missing for visual and hybrid. The subsequent clean matched closure is recorded in Section 8; Indico/Juice expansion, final power/repetition freeze, and confirmatory collection remain pending.

## 8. BookStack clean matched pilot closure (2026-08-23)

- The final clean pilot used the frozen Alibaba configuration (`qwen3-vl-flash`), 1280×720 viewport, JPEG screenshot quality 85, `CUA_MAX_STEPS=10`, `CUA_TIMEOUT_MS=20000`, one bounded semantic retry for empty/invalid function arguments, independent post-save oracle polling up to 5 seconds, and one reset before every cell.
- The canonical task target is the seed book with slug `book` and visible name `Book`. The persisted-state oracle now joins `pages` to `books` by this declared slug instead of hard-coding a numeric `book_id`; this prevents seed-ID/order drift from becoming an evaluator failure.
- Final clean matched pilot: 3 repetitions × 3 arms, all reset gates passed, all clean-state checks passed, and all 9/9 independent oracle checks passed (`playwright 3/3`, `visual 3/3`, `hybrid 3/3`). The artifact remains `confirmatory=false`; it is pilot/admission evidence only.
- Visual and hybrid agent runners now emit standard run records with trace hashes, observation-contract labels, model provenance, timing and retry counts. Batch collection of the append-only JSONL ledger succeeded for 40 accumulated pilot records; prior failures remain retained and were not deleted or relabeled.
- The first 3×3 attempt was 6/9 and the second was 7/9. Their failures were retained as feasibility history. The final 9/9 result was obtained only after fixing (i) provider empty tool-call arguments via one pre-specified semantic retry, (ii) equivalent nested tool-argument wrappers, (iii) screenshot compression that obscured the editor, and (iv) the numeric-book-id oracle mismatch. These changes are now part of the frozen pilot harness and are recorded as protocol-level fixes, not excluded outcomes.
- A pilot power-planning simulation on the final clean artifact yields identical Jeffreys-smoothed completion rates (0.875 for all arms), hence essentially no estimable between-arm variance in this single clean task. This is not evidence of equivalence and is insufficient by itself to freeze a confirmatory repetition count. Fault/evolution conditions and additional SUT/task blocks must contribute the variance inputs before the final power/repetition decision is frozen.

## 9. Indico authenticated matched pilot and provider-grounding diagnosis (2026-08-23)

- The Indico lifecycle now recreates the local experiment account after every `down -v` reset using the official container CLI, then grants administration rights required by the event-creation workflow. It detects the CLI's ANSI-colored table format rather than assuming whitespace-delimited output; the reset gate completed with `event_count=18` and `experiment-user-verified`.
- The authenticated traditional baseline passed after reset, and the independent PostgreSQL oracle returned `matches=1, passed=true` for the expected lecture event. This closes the account/reset/oracle prerequisite and is not agent evidence.
- A real 1-repetition × 3-arm Indico matched pilot was executed with a reset and clean-state oracle before every cell. Result: Playwright `1/1` passed; pure visual `0/1`; hybrid `0/1`; total `1/3`. All three reset gates and pre-run clean oracles passed, so the two agent failures are planning/grounding outcomes rather than infrastructure exclusions. The raw pilot and standard ledger are gitignored under `artifacts/phase2/indico-three-arm-*`.
- Visual traces correctly selected the home `Create event` menu and `Create lecture` entry, then filled title/date, but repeatedly missed the lower form submit control and re-entered title. Hybrid traces repeatedly clicked the title textbox without issuing the required type action. These traces are retained as provider-grounding evidence; no cell is promoted to admission.
- The runner now waits 1 second after Indico menu/form clicks to avoid stale dropdown observations, and hybrid observations expose associated labels, input-submit button semantics, and a declared `interaction` (`type` or `click`) field. The provider driver also issues bounded repeated-click and repeated-type recovery instructions. These are protocol/harness fixes; the post-fix Indico run still failed, so no reliability claim is made.
- Indico fault/evolution harness live gates remain passed (transactional trigger apply/rollback/remove/isolation). Because the clean three-arm agent admission is not yet met, the pre-registered order still freezes Indico confirmatory collection and any final power/repetition decision.

## 10. Juice Shop matched pilot and overlay gate (2026-08-23)

- Added a clean UI-state gate that opens a fresh browser after every container reset and rejects a pre-existing search route; this avoids treating initial product-card markers as task completion. The traditional Playwright fixture now waits for the asynchronously rendered Welcome/cookie overlays before force-dismissing them, fixing an infrastructure-level timeout where the overlay backdrop intercepted the search button.
- The first real Juice Shop 1-repetition × 3-arm attempt retained the traditional overlay failure as feasibility history. After the pre-specified overlay wait fix, the rerun passed the reset and clean-state gates for all cells and produced Playwright `1/1`, visual `0/1`, hybrid `0/1`; total `1/3`. Visual and hybrid failures were independent UI-oracle failures, not reset exclusions. The raw artifact and schema-validated ledger are gitignored under `artifacts/phase2/juice-shop-three-arm-*`.
- The Playwright result uses the visible UI and REST checks only as evaluator-side evidence; the CUA arms receive no oracle fields. Because the agent arms did not pass, Juice Shop is not admitted to confirmatory collection and cannot yet supply final power inputs.
