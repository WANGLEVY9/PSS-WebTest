# External framework adapter status (2026-09-09)

This note records feasibility/admission evidence only. These runs are not part
of the primary matched three-arm pilot or confirmatory collection.

| Framework | PSS path | Evidence | Boundary |
| --- | --- | --- | --- |
| Browser Use 0.13.10 | `framework:browser-use:v02` | BookStack authenticated navigation reached `/books/book`; Qwen3.7-VL-Flash; v0.2 record plus four replay frames and four bounded provider summaries | Hybrid framework smoke; no matched admission |
| Stagehand 3.0.8 | `framework:stagehand:qwen:v02` | Custom `LLMClient` routes Qwen through the Alibaba-compatible endpoint; `stagehand.act` receives screenshot plus Stagehand accessibility snapshot; v0.2 record and replay are registry-valid | Built-in `agent.execute` sends AI-SDK tool-result parts rejected by Qwen. The adapter uses a visible locator fallback when `act` returns no progress; fallback is marked in replay and is not model-only success |
| AgentLab/BrowserGym 0.4.2/0.14.2 | `framework:agentlab:adapter` | `pss-bookstack-open-book` setup, screenshot/DOM/a11y observation, direct action, and independent route+heading oracle pass | This is a task adapter smoke; a model-backed AgentLab policy is not yet admitted |

All external-framework artifacts are stored under ignored
`artifacts/phase2/` paths. The tracked smoke summaries contain no credentials,
raw provider messages, or page screenshots. Configuration registry status is
`implemented` with `admission.status=not-started`; this is intentional until a
matched task block and pilot variance review are complete.
