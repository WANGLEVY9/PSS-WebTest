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

## 4. Agent adapter 与当前 blocker

- 新增 provider-neutral agent adapter：visual/hybrid arm 在每一步调用 observation contract，拒绝结构化信息泄漏，并记录 action、step、observation contract、wall time 和 verdict 状态。
- 新增 `npm run check:agent` readiness gate。当前结果为：

```json
{"status":"blocked","reason":"Agent provider is not configured; missing CUA_PROVIDER, CUA_MODEL, CUA_API_KEY","api_key_present":false}
```

- adapter contract tests 与 observation tests 共 9/9 通过；contract-only driver 不计作 Agent 实验结果。
- 真实三臂 Phase 2 仍被 provider driver 阻塞。要继续执行真实 pure-visual/hybrid runs，需要选择一个可批量、可冻结版本的 CUA provider，并提供本地 `CUA_PROVIDER`、`CUA_MODEL`、`CUA_API_KEY`（或等价的本地 endpoint/token）；密钥不会写入仓库、日志或运行记录。

## 5. 当前退出判断

| 子门槛 | 状态 |
|---|---|
| 三个候选 SUT deterministic reset | 通过本地 feasibility gate |
| 三个任务级 Playwright slice | 通过本地 feasibility gate |
| 三个独立 task oracle | 通过本地 feasibility gate |
| BookStack functional fault + behavior-preserving UI mutation | 已通过 smoke gate |
| Indico/Juice Shop fault/evolution matrix | 尚未完成 |
| pure-visual/hybrid real provider execution | 阻塞，等待 provider driver/凭据 |
| Phase 2 overall exit | 尚未通过 |

下一步是先冻结 provider、模型、截图/结构输入和 action budget，再在 BookStack 上跑真实三臂最小切片；之后扩展 Indico/Juice Shop 的 fault/evolution 条件。
