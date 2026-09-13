# External framework engineering audit and fixes (2026-09-12)

Evidence boundary: engineering audit, environment rebuild and protocol/plumbing
smoke only. Nothing here is confirmatory evidence, no application is admitted,
and the confirmatory population remains 0.

## Why this audit happened

The 2026-09-09 framework smoke evidence pointed at
`/private/tmp/pss-frameworks/{browser-use,agentlab}/bin/python`. That directory
no longer exists, `python3` could not import `browser_use`, `agentlab` or
`browsergym`, and the repository contained **no dependency lock file anywhere**.
The recorded framework results were therefore not reproducible.

A full read-only audit of the four framework layers (native `pss-native`,
Stagehand, Browser Use, AgentLab/BrowserGym) found 24 defects. This report
records the defect matrix, the fixes, and what remains open.

## Defect matrix

| ID | Level | Defect | Location (before fix) | Status |
|---|---|---|---|---|
| F-01 | P0 | Framework version hardcoded in five places, so the registry cross-check compared a value with itself | `framework-browser-use-runner.py:198`, `framework-browser-use-smoke.py:62`, `run-browser-use-bookstack-v02.mjs:39`, `run-stagehand-bookstack-v02.mjs:113`, `run-agentlab-bookstack-adapter.py:26` | **fixed** |
| F-02 | P0 | Stagehand `passed` ignored `fallbackCount`, so a locator-fallback run was recorded as `completed` | `run-stagehand-bookstack-v02.mjs:67-75,92,110` | **fixed** |
| F-03 | P0 | Stagehand adapter never asserted the observation boundary at runtime | `run-stagehand-bookstack-v02.mjs:1-8` | **fixed** (adapter-controlled payloads) |
| F-04 | P1 | Custom Qwen client forwarded AI-SDK tool-result parts untouched | `stagehand-qwen-client.mjs:32` | open |
| F-05 | P1 | Malformed provider responses were silently coerced (fail-open) | `stagehand-qwen-client.mjs:78-80` | open |
| F-06 | P0 | Recorded model could differ from the model actually called | `run-browser-use-bookstack-v02.mjs`, `run-stagehand-bookstack-v02.mjs` | **fixed** |
| F-07 | P1 | Driver default `timeoutMs=15000` disagreed with manifest `timeout_ms=30000` | both drivers | open |
| F-08 | P1 | Most native runners did not set `PSS_REQUIRE_FROZEN_PROFILE=1` | 5 runner scripts | open |
| F-09 | P1 | `failure-taxonomy` produced 9 of the 15 declared categories | `failure-taxonomy.mjs` vs `run-records.mjs` | open |
| F-10 | P2 | `FRAMEWORK_VARIANTS` ids and registry `framework.id` had no cross-check | — | **partly fixed** (validator warns) |
| F-11 | P1 | `provider_raw_content_persisted` was prose only | research JSON | open |
| F-12 | P1 | AgentLab version was the composite string `"0.4.2/0.14.2"` | `run-agentlab-bookstack-adapter.py:26` | **fixed** |
| F-13 | P1 | AgentLab/Stagehand smoke markers had no consumer | — | open |
| F-14 | P1 | The three adapters used three different oracle implementations | — | open |
| F-15 | P1 | Browser Use browser lifecycle had no `try/finally` | `framework-browser-use-runner.py` | **fixed** |
| F-16 | P1 | Several exceptions were silently swallowed | runner + replay | open |
| F-17 | P2 | Fallback XPath was too wide and could click the wrong book | `run-stagehand-bookstack-v02.mjs:68` | **fixed** |
| F-18 | P2 | Hardcoded macOS Chrome path and `/private/tmp` profiles | 4 files | **fixed** |
| F-19 | P2 | `run_id` used `Date.now()` only, so same-millisecond runs collided | 3 runners | **fixed** |
| F-20 | P2 | `prompt_digest` / `action_schema_version` were unverified declarations | — | open |
| F-21 | P2 | A `null` decision was silently treated as done | `agent-adapter.mjs:44-47` | open |
| F-22 | P2 | `check-framework-readiness.mjs` spawned commands without a timeout | — | **fixed** |
| F-23 | P2 | Missing provider env raised a bare `KeyError` | Python runners | **fixed** |
| F-24 | P2 | Dead `viewport`/`slow_mo`/`timeout` fields on the AgentLab task | `pss_bookstack.py:30-32` | **fixed** |
| F-25 | P0 | **The scripted comparator arm declared Playwright 1.55 while 1.62.1 was installed and locked** | `configuration-registry.v0.2.json` scripted configs | **fixed** |

### F-25 in detail — the same defect reached the primary comparator arm

F-01 was not confined to the external frameworks. `package.json` declares
`@playwright/test: ^1.55.0`, a caret range, and the lockfile resolved
**1.62.1**. The configuration registry nevertheless declared `playwright@1.55`
for both scripted configurations, and the scripted run record copies the
registry value into `provenance.framework_version`.

Because both sides of `validateRunRecordAgainstRegistry()` held `"1.55"`, the
cross-check passed and **the primary comparator arm's records mis-declared the
browser automation version across the historical evidence** — 142 ledgers were
scanned and every scripted record found carried `1.55`.

Resolution:

- Playwright is now registered in the framework manifest (`h-playwright`,
  resolved 1.62.1) like any other framework.
- The **executable** scripted configuration
  (`scripted-playwright-accessibility-human-v2`) now declares `1.62.1`, so new
  records state the truth.
- The **legacy-pilot** configuration keeps its historical `1.55` declaration,
  because rewriting it would falsify what those ledgers ran with. The validator
  reports the deviation as a warning and it is documented here.
- `validate:framework-manifest` now fails closed if an executable scripted
  configuration's declared version differs from the installed one, and a
  contract test asserts the same.

Consequence for the historical evidence: any scripted record written before
today carries a `framework_version` that reflects the registry declaration, not
the running build. Those ledgers are append-only and are **not** rewritten; the
deviation is recorded instead. Whether the environment was actually on 1.55 when
those records were produced cannot be established from the repository, so the
records should be treated as **version-uncertain** rather than wrong.

## The core fix: version truth

Before, `framework_version` was a **string literal** in the Python runners, the
JS runners and the configuration registry. All three agreed by construction, so
`validateRunRecordAgainstRegistry()` — which compares
`configuration.framework.version` with `provenance.framework_version` — **could
never fail**. A rebuilt environment would have silently reported the old version
in every run record, violating the project's own rule that versions are never
pooled silently.

After:

- `code/config/frameworks/framework-environment-manifest.v0.1.json` (tracked) is
  the single declaration: track, package, declared version, interpreter, lock
  file, registry configuration ids.
- `code/src/framework-version.mjs` reads the **installed** version and exposes
  `assertFrameworkVersion()` and `assertRegistryAgreesWithManifest()`, both
  fail-closed.
- `code/scripts/pss_framework_version.py` is the Python-side equivalent
  (`require_installed()` via `importlib.metadata`).
- Both JS runners validate the installed version against the manifest **and**
  the registry before writing a record, and reject a `CUA_MODEL` that differs
  from the registry's `model_id`.

Verified behaviour:

```
installed 3.0.8 vs manifest 4.1.0  -> FrameworkVersionMismatchError
registry 9.9.9 vs manifest 3.0.8   -> FrameworkVersionMismatchError
```

A regression test additionally scans the five runner sources for
`framework_version: "<x.y.z>"` literals so the defect cannot come back.

## Reproducible environments (dual track)

Environments live in the gitignored `third_party/frameworks/`; the manifest and
lock files are tracked, so a clone rebuilds with one command
(`npm run frameworks:build`).

| Environment | Track | Version | Interpreter | Status |
|---|---|---|---|---|
| `h-browser-use` | historical | 0.13.10 | python 3.12.14 | installed |
| `l-browser-use` | latest | — | — | **collapsed-to-historical** |
| `h-agentlab` | historical | 0.4.2 (+browsergym 0.14.2) | python 3.12.14 | installed |
| `l-agentlab` | latest | — | — | **collapsed-to-historical** |
| `h-stagehand` | historical | 3.0.8 | node v26.1.0 | installed |
| `l-stagehand` | latest | 4.1.0 | node v26.1.0 | installed, **adapter-incompatible** |

### Honest finding: the dual track mostly collapses

The user asked for a dual track (freeze the old version, add upstream latest as a
separate stratum). Installation resolved:

- **browser-use latest == 0.13.10 == the frozen version**
- **agentlab latest == 0.4.2 == the frozen version**
- **stagehand latest == 4.1.0 != 3.0.8** — the only genuine second stratum

So for two of the three frameworks there is **no second stratum to compare**.
This is recorded as `install_status: collapsed-to-historical` with an explicit
note, rather than reported as a distinct track. The duplicate ~2 GB of identical
virtualenvs is a disk cleanup item, not a scientific one.

### Stagehand 4.1.0 is not adapter-compatible

Importing the installed Track L entry (`dist/index.mjs`) shows the package is
ESM-only (`exports["."].import`), cannot be resolved through `require.resolve`,
and — critically — **no longer exports `LLMClient`**, the base class that
`scripts/stagehand-qwen-client.mjs` extends. Export count drops from 89 (3.0.8)
to 30 (4.1.0).

Consequence: the latest Stagehand track **cannot run the existing Qwen client**
and must not be reported as a usable stratum until a v4-compatible client is
written. This is recorded in the manifest as
`adapter_compatibility.status = incompatible`.

## Isolation and browser-build fixes

- **Per-run browser profiles.** `user_data_dir` was
  `/private/tmp/pss-browser-use-pilot-profile` — shared across runs (leaking
  cookies and localStorage) and liable to be wiped by OS cleanup. Profiles are
  now created per run under `artifacts/phase2/browser-profiles/` and removed
  before reuse.
- **No machine-specific Chrome.** `resolve_chrome_executable()` now returns an
  executable **only** when `PSS_CHROME_EXECUTABLE` is explicitly set; the
  default is the framework's bundled Chromium, so all arms share one frozen
  browser build. System Chrome detection was kept, but only as a diagnostics
  field that never feeds a launch default.
- **Browser lifecycle.** The Browser Use runner's post-run section is now inside
  `try/finally`, so a failure there no longer leaks the Chromium process.
- **Run-id collisions.** Run ids include a random suffix.
- **Missing env vars.** `require_env()` produces one clear error instead of a
  bare `KeyError`.

## Stagehand fallback semantics

Before, a cell that reached the checkpoint only because the harness clicked a
visible locator fallback was recorded as `status: completed` with
`failure_category: null`. The "not a pure model success" claim was prose only.

The rule now lives in the tested module
`code/src/framework-adapter-outcome.mjs`:

| Situation | `checkpoint_reached` | `status` | `failure_category` | `model_only_success` |
|---|---|---|---|---|
| oracle passed, no fallback | true | `completed` | null | true |
| oracle passed, fallback used | true | `test-failure` | `framework-fallback` | false |
| adapter failure | false | `test-failure` | `provider` | false |
| oracle failed | false | `test-failure` | `oracle` | false |

Three failure categories were added to the run-record schema and validator:
`framework-fallback`, `framework-version-mismatch`, `framework-env-missing`.
They are deliberately kept separate from model-capability categories.

## Selector defect found by the smoke

The audit flagged the fallback XPath
`//main//a[starts-with(normalize-space(.),'Book')][1]` as too wide. Tightening it
to `normalize-space(.)='Book'` then matched **zero** elements and broke the
smoke. DOM inspection explains both: the seeded shelf holds three books
(`/books/book`, `/books/book1`, `/books/book2`), every anchor's text begins with
"Book" **and** includes the description, so `starts-with` matched all three
(selecting the right one only by ordering) and exact text matched none.

The fallback now selects by canonical route (`a[href$='/books/book']`), which is
unique and is exactly what the oracle checks.

## Test and gate coverage added

| Artefact | Purpose |
|---|---|
| `tests/contracts/framework-version-probe.test.mjs` | version truth, fail-closed mismatch, no hardcoded literal regression, no placeholder registry versions |
| `tests/contracts/framework-track-isolation.test.mjs` | track separation, collapsed-track marking, no un-resolved version claims |
| `tests/contracts/stagehand-fallback-marker.test.mjs` | fallback semantics, observation-token detection |
| `tests/contracts/framework-adapter-redaction.test.mjs` | redaction boundary, no `/private/tmp` profile, no hardcoded Chrome default |
| `npm run validate:framework-manifest` | manifest == registry, lock files present |
| `npm run frameworks:readiness` | importable **and** version-exact **and** browser-resolvable, fail-closed |

`npm run test:contracts`: **165/165 pass** (138 before this round).

## Open items

1. F-04/F-05 — the Qwen client still forwards tool-result parts and coerces
   malformed responses. Worth fixing before any matched Stagehand arm.
2. F-07 — the driver default `timeoutMs` still disagrees with the manifest.
3. F-08 — five native runners still do not force the frozen provider profile.
4. F-09 — `failure-taxonomy` produces 9 of 15 declared categories; the fallback
   `execution` category can mask provider problems.
5. F-13/F-14 — the AgentLab and Stagehand smoke markers have no ledger consumer
   and the three adapters still use three different oracle implementations.
6. Stagehand 4.x needs a v4-compatible Qwen client before Track L can be used.
7. Reclaim the ~2 GB of duplicate collapsed virtualenvs.

See `2026-09-12-framework-smoke-by-track.md` for the per-track smoke results.
