# Phase 2 feasibility audit: candidate SUTs, benchmarks, and harnesses

**Project:** PSS-WebTest (Pixels, Page Structure, or Scripts?)
**Audit date:** 2026-08-16 (updated after first implementation increment)
**Scope:** Phase 2 of `PROJECT_EXECUTION_PLAN.md`: candidate self-hosted Web applications, reusable benchmark artifacts, and evaluation harnesses.
**Evidence rule:** `Confirmed` means directly stated in an official repository, official documentation, or the archived artifact record linked below. `Inferred` is a reasoned engineering implication that still needs a local smoke test. `Unknown` means the public material does not establish the property.

**Time-window policy:** For Phase 2 design and collision decisions, references from 2023 onward are primary. Earlier work is retained only for terminology or foundational taxonomy and is not used as evidence of current CUA capability.

## Executive decision

The most credible three-month path is **not** to use public/live websites. Use a version-pinned, self-hosted application bundle for the controlled study and use BrowserGym/WebArena-Verified only as a harness/reference or external validity slice.

The best initial SUT candidate is the four-application bundle shipped by WebTestPilot: BookStack, Indico, InvoiceNinja, and PrestaShop. Its repository explicitly includes container definitions, fixed versions, ports, seeded SQL, and a seed-generation/start/stop workflow. This is a strong starting point for Study A (functional faults) and provides direct comparability with a close prior study. However, its four bundled images are documented as `linux/amd64`; this is a material risk on the current `arm64` development machine, and the license of each bundled application/image and all transitive assets must be audited separately before redistribution.

**Provisional recommendation:** run a vertical slice first on **BookStack + Indico**; keep **PrestaShop** as a high-complexity candidate; treat **InvoiceNinja** as a license-review candidate because its upstream repository states that v5 is under the Elastic License. Add one lightweight alternative (OWASP Juice Shop or Focalboard) only if the WebTestPilot bundle cannot be made deterministic on the local/CI architecture.

No candidate should enter confirmatory data collection until a local smoke test verifies: clean install, exact-version pinning, account creation/login, reset to a known snapshot, independent oracle query, Playwright access, screenshot-only access, and one behavior-preserving UI mutation.

## Local environment observations

The current machine reports `arm64`, Node `v20.18.0`, Python `3.9.6`, and no `docker`, `colima`, or `podman` executable was found on `PATH` at audit time. The repository's `code/package.json` requires Playwright `^1.55.0` and `dotenv`; `code/README.md` correctly refuses to use an external website, but currently has no SUT, reset script, evaluator, or agent adapter. Therefore the feasibility gate is currently **not passed**. Docker/Compose (or a documented alternative) and a supported Python environment are prerequisites, not assumptions.

## Candidate and artifact matrix

| Candidate/artifact | Primary role | License evidence | Install/offline evidence | Reset/account evidence | Independent oracle | UI mutation / Playwright | Visual + hybrid access | Three-month risk | Status |
|---|---|---|---|---|---|---|---|---|---|
| **WebTestPilot benchmark bundle** (`code-philia/WebTestPilot`) | Primary SUT bundle; 4 apps and injected-bug benchmark | Repository is marked CC-BY-4.0. The bundled apps are third-party and must be licensed separately; BookStack and Indico upstream are MIT, while Invoice Ninja v5 is Elastic; PrestaShop uses OSL. | Official `webapps/README.md` lists pinned versions (Indico 3.3.6, BookStack 25.02.1, InvoiceNinja 5.11.61, PrestaShop 8), ports, Docker files, and `start_app.sh`/`stop_app.sh`; images are `linux/amd64`. | `seed.sql` per app, deterministic initial data, default accounts referenced from `baselines/setup_function.py`; exact restore behavior after a fault is not independently verified. | Benchmark includes injected bugs and step assertions; hidden DB/API assertions for our study still require a new evaluator. | `benchmark/transform` gives a starting point for mutations; all apps are browser-accessible and Playwright-compatible in principle. Mutation preservation is not guaranteed and must be checked per task. | WebTestPilot includes a browser-use mode and an optional SoM visual grounding mode; its code is a useful hybrid/agent adapter reference, not a drop-in pure-visual arm. | **High:** Docker absent locally; amd64-on-arm64 emulation; large apps and multiple services; third-party license aggregation. | **Conditional primary** |
| **WebTestPilot benchmark/evaluator** | Reuse oracle/bug-injection ideas and baseline scripts | CC-BY-4.0 repository license confirmed; downstream data/model licenses need separate review. | Official repo has `benchmark`, `baselines`, `experiments`, and `webapps`; setup script checks `uv`, Docker, Compose. | Seed generation and four-app setup are documented; no guarantee that its evaluator matches our independent hidden-state oracle. | Their paper/repo evaluates task completion and bug detection, but this is not an independent evaluator for a three-arm comparison; reuse requires reimplementation/audit. | Includes bug transforms and a Playwright-backed browser-use path. | Hybrid/visual support confirmed; pure visual isolation must be implemented and instrumented by us. | **Medium–high:** reusing it too directly creates collision and oracle-validity risks. | **Reference/reuse only** |
| **WebTestBench** (`friedrichor/WebTestBench`) | Directly relevant benchmark/reference | GitHub page explicitly marks Apache-2.0. | Seven app categories; each project can be deployed with `npm install && npm run dev`; evaluation code handles deployment/teardown. Python >=3.11 and Node >=18; Claude Code, Playwright MCP, and provider keys are required. | Automatic deployment/teardown is stated; deterministic reset semantics and account isolation are not documented in the README. | Scoring code and `scoring_oracle.py` exist; benchmark focuses checklist generation + defect detection and is not a matched traditional Playwright comparison. | Application source is available; mutations for behavior-preserving UI evolution are not provided. Playwright MCP provides a structured agent route. | Visual CUA support is implied by “computer-use agents” and Playwright MCP; strict screenshot-only vs hybrid observation contracts are not supplied. | **High:** provider/Claude Code dependency, API spend, online model stack, and unknown task reset details. | **Reference, not primary SUT yet** |
| **Chevrot et al. Autonomous Tester Agent Benchmark** (Zenodo DOI 10.5281/zenodo.15198569) | Collision/replication reference; 3 offline apps, 100 test cases | Zenodo record exposes the artifact and DOI but does not expose a clear repository software/data license in the public record. | Artifact is a 2.6 MB `ISSTA_ARTEFACT.zip`; offline apps and replication code are described, but exact OS/runtime and current install steps are unknown until archive inspection. | 100 cases, half mutated; reset/account procedures are not established from the record. | Assertions and verdicts are part of the benchmark description, but an independent hidden-state evaluator for our design is unknown. | Browser interaction is supported by SeeAct-ATA/PinATA; mutation cases are available, but not our UI-evolution taxonomy. | SeeAct is multimodal/browser-based; hybrid structured-page and strict screenshot-only arms are not directly matched. | **Medium–high:** artifact availability is good, but license, runtime, and reset must be inspected before reuse. | **Reference/collision candidate** |
| **WebArena** (`web-arena-x/webarena`) | Large self-hosted web-agent harness; possible external-validity slice | Apache-2.0 confirmed in official repository. | Canonical implementation provides Docker resources, six web services, and an AMI; setup documentation is substantial but assumes Docker/AWS or a large host. | Official environment README documents reset by stopping/removing/restarting containers; account cookies and service state are benchmark-specific. | Task evaluators are available, but they score web-agent task success, not defect verdicts against seeded faults. | BrowserGym/Playwright integrations are available; no behavior-preserving mutation framework. | Can expose HTML, accessibility tree, and pixels through BrowserGym; pure visual isolation would need a custom wrapper. | **Very high** for a three-month controlled study: many services, AWS/large disk, complex state, and no fault-injection oracle. | **Harness/reference only** |
| **VisualWebArena** (`web-arena-x/visualwebarena`) | Multimodal benchmark/reference for visual arm | MIT license confirmed in official repository. | Python 3.10/3.11, Playwright, Dockerized standalone environments; 910 tasks and multiple site services. | README documents URLs, reset token for Classifieds, auto-login cookies, and `prepare.sh`; complete reset scripts are listed as a TODO, so deterministic reset is not confirmed. | Execution-based task scoring is provided; hidden defect oracle is not. | BrowserGym/Playwright compatible; no mutation generator and no matched traditional suite. | Visual observation and accessibility-tree variants are explicitly supported in evaluation. | **Very high**: multi-service Docker setup, 910 tasks, account cookies, lack of reset scripts, and no injected fault model. | **Visual-agent reference only** |
| **WebArena-Verified** (`ServiceNow/webarena-verified`) | Evaluator/oracle reference and low-cost external-validity slice | Apache-2.0 confirmed for repository. Environment licenses are separately documented and must be checked. | Official repo supports `pip`, `uvx`, and Docker; full (812) and hard (258) datasets; offline network-trace replay is explicitly supported. | Offline trace replay removes live-environment reset for scoring, but it is not an interactive self-hosted application for our mutation study. | Strongest oracle evidence in this audit: manually reviewed tasks/evaluators, deterministic type-aware normalization and structural comparison, no LLM judge. | Evaluates recorded responses/traces rather than a mutable local UI; no UI mutation system. | Agent observations are upstream-dependent; not a three-arm visual/hybrid/script comparison. | **Medium** as a scoring/oracle reference, **not suitable** as our primary UI-evolution SUT. | **Use for evaluator design/reference** |
| **BrowserGym** (`ServiceNow/BrowserGym`) | Unified harness/adapters; benchmark integration | Apache-2.0 confirmed in official LICENSE. | `pip install browsergym`; benchmark-specific setup remains required; `playwright install chromium`; supports MiniWoB, WebArena, VisualWebArena, WorkArena, WebArena-Verified, etc. | Reset is delegated to each benchmark; no generic application snapshot/reset guarantee. | Provides task rewards/evaluators, not defect-oracle authority for our study. | New tasks can inherit `AbstractBrowserTask`; strong integration point for Playwright and structured observations. | Officially supports HTML, accessibility tree, screenshots, and multimodal benchmarks; pure-visual contract still needs a wrapper that rejects structured observations. | **Medium–high:** valuable harness but Python version/benchmark-specific dependencies and heavy environments. | **Harness candidate** |
| **OWASP Juice Shop** (`juice-shop/juice-shop`) | Lightweight alternative SUT; e-commerce/security-style workflows | MIT license stated by official repository. | Source install and Docker run are documented; single Node/SQLite app is likely easier than multi-service bundles. | Startup creates a local SQLite DB and has self-healing checks; a canonical experiment reset/seed endpoint is not confirmed in official README and must be implemented/tested. | Challenge APIs and DB can support independent assertions, but a clean/faulty functional oracle for ordinary workflows must be designed. | Single frontend is easy to instrument and mutate; Playwright access is straightforward. | Screenshot-only and DOM/accessibility arms can be implemented directly in our harness. | **Medium:** strong engineering fallback, but app is intentionally insecure/CTF-oriented and may bias workflow types. | **Fallback candidate** |
| **BookStack** (`BookStackApp/BookStack`) | Focused content-management SUT; also in WebTestPilot bundle | MIT license confirmed by official repository. | Self-hosted Docker support exists through official/maintained images; WebTestPilot supplies an exact-version container and seed SQL. | WebTestPilot seed SQL is confirmed; upstream general installation does not establish an experiment-grade reset script. | Database/API assertions are feasible; task-specific hidden oracles must be authored. | Rich CRUD/content workflows and DOM/layout mutations are feasible; Playwright is direct. | Directly usable for all three arms after our adapter layer. | **Low–medium** if using WebTestPilot container; **medium** if rebuilding upstream stack. | **Best vertical-slice candidate** |
| **Indico** (`indico/indico`) | Event-management/workflow SUT; also in WebTestPilot bundle | MIT license confirmed by official repository. | Official `indico-containers` provides Docker Compose, but warns the setup is “as is” and not as battle-tested; WebTestPilot pins an exact container. | WebTestPilot seed SQL exists; official container docs do not provide a benchmark reset protocol. | DB/API and visible event/registration assertions are feasible; must be authored and checked independently. | Multi-step, role, form, and calendar workflows; Playwright feasible. | Directly usable for all three arms in principle. | **Medium–high:** multiple services (Postgres, Redis, Celery, Nginx), architecture and reset complexity. | **Strong candidate after smoke test** |
| **PrestaShop** (`PrestaShop/PrestaShop`) | E-commerce/admin SUT; also in WebTestPilot bundle | Official repository states open-source and includes OSL license material; exact bundled-image dependency/license set still needs review. | Official Docker development environment and default credentials are documented; WebTestPilot supplies pinned v8 bundle. | Official Docker setup auto-installs when a parameter file is absent; this can support snapshot reset, but the exact benchmark reset is not confirmed. | Store/admin/database assertions are feasible; payment/external services must be excluded. | Very rich UI and admin workflows; mutations feasible but high maintenance. | Directly usable for all arms in principle. | **High:** large app, setup/runtime cost, many assets, architecture/emulation risk. | **Complexity candidate only** |
| **Invoice Ninja v5** (`invoiceninja/invoiceninja`) | Billing/workflow SUT; also in WebTestPilot bundle | Official repository states v5 is under the Elastic License; not a permissive MIT/Apache dependency. | Official Docker files and seeded instance instructions exist; WebTestPilot pins v5.11.61. | Official docs provide `migrate:fresh --seed` and test-data commands; WebTestPilot has seed SQL. | Strong data/API oracle potential (invoices, clients, totals), but payment/PDF/external integration must be disabled. | Rich forms and tables; Playwright feasible. | Technically possible for all arms. | **Very high:** license/redistribution concerns, PDF/Chrome service, setup complexity, and heavy runtime. | **Do not include until legal/ops review** |
| **Focalboard** (`mattermost-community/focalboard`) | Lightweight project-management alternative | Repository has a license file; exact license text should be copied into our audit before redistribution. Repository warns standalone project is currently not maintained. | Official Docker image/build and SQLite or Postgres modes are documented. | Persistent `fbdata` volume is explicit; deleting/isolating the volume can reset, but benchmark seed/account reset is not documented. | SQLite/REST API assertions appear feasible; hidden oracle schema needs local inspection. | Kanban/form/modal workflows; easy to mutate; Playwright direct. | Technically usable for all three arms. | **Medium:** stale maintenance, unknown current browser behavior, license text and reset need verification. | **Fallback candidate after local audit** |

## Evidence-based ranking

### Tier 1: run a smoke test immediately

1. **BookStack** — easiest vertical slice, MIT, seeded container already supplied by WebTestPilot, clear content CRUD and cross-page state.
2. **Indico** — complementary workflow and role/form complexity, MIT, seeded container supplied by WebTestPilot.

### Tier 2: keep for breadth after Tier 1 passes

3. **PrestaShop** — useful e-commerce/admin diversity but expensive and architecture-sensitive.
4. **OWASP Juice Shop** — lightweight fallback with MIT license and simple Docker startup, but its challenge-oriented design is less representative of ordinary enterprise UI testing.
5. **Focalboard** — lightweight fallback, but maintenance status and reset/seed behavior are not yet adequate for confirmatory inclusion.

### Tier 3: do not make primary SUTs without additional gates

6. **Invoice Ninja** — technical fit is good, but the Elastic License and service complexity create avoidable redistribution and operational risk.
7. **WebArena/VisualWebArena** — excellent external validity and multimodal harness precedent, but too many services and no defect/evolution oracle for this three-month study.
8. **WebTestBench** — valuable reference and possible integration source, but provider-specific setup and unknown reset semantics make it unsuitable as the only primary SUT.
9. **Chevrot benchmark** — high collision value and potentially reusable offline apps, but license/runtime/reset details require archive inspection first.

## Required local verification checklist (before inclusion)

For every provisional SUT, create an immutable record containing:

1. Exact upstream commit/tag, image digest, architecture, and dependency lockfile.
2. License files for the application, container, seed data, screenshots, and benchmark artifacts; do not infer a bundled app's license from the harness repository.
3. `start`, `ready`, `login`, `snapshot`, `reset`, and `stop` commands that work twice in a fresh directory.
4. Ten clean repetitions of one Playwright workflow with identical visible and hidden outcomes.
5. One independent evaluator assertion that reads only permitted backend/database/API state after the run.
6. A screenshot-only trace showing that DOM, accessibility-tree, selector, network, and app-state channels are absent from the pure-visual arm.
7. One behavior-preserving mutation in each target family (DOM structure, accessible name/role, layout, and runtime timing), verified by the traditional oracle before any agent run.
8. A resource and cost log on the actual machine/CI architecture. If amd64 emulation is required, record it as a threat to latency and reproducibility rather than silently treating it as native.

## Go/no-go outcome for Phase 2

Current outcome: **not yet ready for confirmatory runs**.

The study may proceed to Phase 3 only after:

- Docker/Compose or an equivalent reproducible runtime is installed and documented;
- BookStack and Indico each pass the two-run start/reset smoke test;
- at least one fallback SUT has a verified legal and operational path;
- all primary tasks have hidden machine-checkable oracles;
- the arm adapters can run against the same local URL and reset snapshot;
- the architecture/emulation decision is recorded in the decision log.

Until these conditions are met, all numbers from any agent trial are feasibility observations, not experimental evidence.

## 2026-08-16 implementation update

The first executable harness increment is now present under `code/`: a post-2022-scoped task manifest, task/run-record schemas, manifest validator, and local SUT readiness probe. The task manifest contains provisional BookStack and Indico vertical-slice intents, but their reset status remains `unverified` and their oracle status remains `draft`. Node dependencies installed successfully and the Playwright CLI is available; Chromium download failed with `ECONNRESET`. Docker/Compose is still unavailable on the arm64 host. Therefore the Phase 2 confirmatory gate remains **not passed**.

## Sources inspected

- [WebTestPilot repository](https://github.com/code-philia/WebTestPilot) and [bundled webapps README](https://github.com/code-philia/WebTestPilot/blob/main/webapps/README.md)
- [WebTestPilot benchmark directory](https://github.com/code-philia/WebTestPilot/tree/main/benchmark) and [CC-BY-4.0 license](https://github.com/code-philia/WebTestPilot/blob/main/LICENSE)
- [WebTestBench repository](https://github.com/friedrichor/WebTestBench)
- [Chevrot et al. artifact record](https://zenodo.org/records/15198569), DOI [10.5281/zenodo.15198569](https://doi.org/10.5281/zenodo.15198569)
- [WebArena repository](https://github.com/web-arena-x/webarena) and [Docker/reset documentation](https://github.com/web-arena-x/webarena/blob/main/environment_docker/README.md)
- [VisualWebArena repository](https://github.com/web-arena-x/visualwebarena)
- [BrowserGym repository](https://github.com/ServiceNow/BrowserGym)
- [WebArena-Verified repository](https://github.com/ServiceNow/webarena-verified)
- [BookStack repository](https://github.com/BookStackApp/BookStack)
- [Indico repository](https://github.com/indico/indico) and [official containerization repository](https://github.com/indico/indico-containers)
- [PrestaShop repository](https://github.com/PrestaShop/PrestaShop)
- [Invoice Ninja repository](https://github.com/invoiceninja/invoiceninja)
- [OWASP Juice Shop repository](https://github.com/juice-shop/juice-shop)
- [Focalboard repository](https://github.com/mattermost-community/focalboard)
- [SeeAct repository](https://github.com/osu-nlp-group/seeact)
