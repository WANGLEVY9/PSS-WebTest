# External framework adapter status (2026-09-12)

Supersedes `framework-adapter-status-2026-09-09.md`. Evidence boundary: adapter
engineering status only. These runs are not part of the primary matched
three-arm pilot and are not confirmatory.

## Environment manifest

Single source of truth: `code/config/frameworks/framework-environment-manifest.v0.1.json`.
Environments live in the gitignored `third_party/frameworks/`; the manifest and
lock files are tracked, so a clone rebuilds with `npm run frameworks:build`.

| Environment | Track | Package | Version | Interpreter | Install | Adapter |
|---|---|---|---|---|---|---|
| `h-browser-use` | historical | browser-use | 0.13.10 | python 3.12.14 | installed | compatible |
| `l-browser-use` | latest | browser-use | — | — | collapsed-to-historical | — |
| `h-agentlab` | historical | agentlab / browsergym | 0.4.2 / 0.14.2 | python 3.12.14 | installed | compatible |
| `l-agentlab` | latest | agentlab / browsergym | — | — | collapsed-to-historical | — |
| `h-stagehand` | historical | @browserbasehq/stagehand | 3.0.8 | node v26.1.0 | installed | compatible |
| `l-stagehand` | latest | @browserbasehq/stagehand | 4.1.0 | node v26.1.0 | installed | **incompatible** |

Readiness gate (`npm run frameworks:readiness`): `{"ready": 4, "collapsed-to-historical": 2}`.

## Track collapse (honest finding)

Upstream latest equals the frozen version for **browser-use (0.13.10)** and
**agentlab (0.4.2)**. Only Stagehand has a genuine second version (3.0.8 vs
4.1.0). The collapsed entries are recorded as `collapsed-to-historical` with a
note and must never be reported as independent strata.

## Stagehand 4.1.0 is adapter-incompatible

- ESM-only: `exports["."].import = ./dist/index.mjs`; not resolvable via `require.resolve`.
- Exports fall from 89 (3.0.8) to 30 (4.1.0).
- **`LLMClient` is no longer exported** — the base class
  `scripts/stagehand-qwen-client.mjs` extends. `AgentProvider` is gone too.

Required work: a Stagehand v4-compatible Qwen client, then a model-only smoke.

## Adapter status per framework

| Framework | Path | Evidence | Boundary |
|---|---|---|---|
| Native `pss-native` | `provider:pss-native` | visual + hybrid drivers, frozen protocol manifest, 165 contract tests | primary baseline; unchanged this round |
| Stagehand 3.0.8 | `framework:stagehand:qwen:v02` | reaches `/books/book` with a passing oracle, but one of two steps needed the harness locator fallback | `fallback_count=1` → `model_only_success=false`, `failure_category=framework-fallback`. **Not ready to be a matched arm.** |
| Browser Use 0.13.10 | `framework:browser-use:v02` | 4 actions, 32.5 s, `final_url_path=/books/book`, independent oracle passed, v0.2 record written | exploratory smoke; not matched |
| AgentLab / BrowserGym 0.4.2 / 0.14.2 | `framework:agentlab:adapter` | adapter smoke passed with the bundled Chromium, task oracle passed, 4.5 s | task adapter only; a model-backed AgentLab policy is still a separate adapter |

## Version truth

Every framework run record now carries the version read from the **installed
distribution**, plus the environment id and track:

```json
{"framework_version": "0.13.10", "framework_environment_id": "h-browser-use", "framework_track": "historical"}
```

Both JS runners validate the installed version against the manifest **and** the
registry before writing a record, and reject a `CUA_MODEL` that disagrees with
the registry's `model_id`. A mismatch fails closed:

```
installed 3.0.8 vs manifest 4.1.0 -> FrameworkVersionMismatchError
registry 9.9.9 vs manifest 3.0.8  -> FrameworkVersionMismatchError
```

## Browser build

The Python adapters no longer inject a machine-specific Chrome path. The default
is the framework's bundled Chromium so all arms share one frozen browser build;
`PSS_CHROME_EXECUTABLE` is an explicit, recorded override. System Chrome is
detected for diagnostics only and never feeds a launch default.

Browser profiles are created per run under `artifacts/phase2/browser-profiles/`
instead of a shared `/private/tmp` path.

## Failure categories

Three framework-boundary categories were added and are kept separate from
model-capability categories: `framework-fallback`, `framework-version-mismatch`,
`framework-env-missing`.

## Open items

1. Stagehand v4 Qwen client.
2. F-04/F-05 in the v3 client: strip AI-SDK tool-result parts; stop coercing
   malformed responses (fail-open → fail-closed).
3. F-07 driver `timeoutMs` still disagrees with the manifest `timeout_ms`.
4. F-08 five native runners still do not force `PSS_REQUIRE_FROZEN_PROFILE=1`.
5. F-13/F-14 the AgentLab and Stagehand smoke markers have no ledger consumer;
   the three adapters use three different oracle implementations.
6. Reclaim the duplicate collapsed virtualenvs (~2 GB, gitignored).

Full defect matrix: `results/phase2/2026-09-12-framework-engineering-audit.md`.
Per-track smoke results: `results/phase2/2026-09-12-framework-smoke-by-track.md`.
