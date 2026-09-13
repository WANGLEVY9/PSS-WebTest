# Framework smoke by track (2026-09-12)

Evidence boundary: protocol/plumbing smoke only. These runs prove that an
environment can import, launch a browser and reach the oracle; they are not
matched three-arm evidence, are not pooled with the native arms, and are not
confirmatory.

Tracks are never pooled. A collapsed track is not reported as a stratum.

## Track H (historical / frozen)

| Framework | Environment | Version source | Result | Detail |
|---|---|---|---|---|
| AgentLab / BrowserGym | `h-agentlab` (python 3.12.14) | `importlib.metadata` | **completed, oracle passed** | `pss-bookstack-open-book`, path `/books/book`, heading count 1, 4,516 ms |
| Browser Use | `h-browser-use` (python 3.12.14) | `importlib.metadata` | **completed, oracle passed** | 4 actions, 32,504 ms, `final_url_path=/books/book`, v0.2 record written |
| Stagehand | `h-stagehand` (node v26.1.0) | `package.json` | **checkpoint reached, NOT model-only** | `fallback_count=1`, `model_only_success=false`, `failure_category=framework-fallback` |

### Evidence that the fixes work

The run records now carry the environment and track, read from the probe:

```
"framework_version": "0.13.10",
"framework_environment_id": "h-browser-use",
"framework_track": "historical"
```

```
"framework_version": "3.0.8",
"framework_environment_id": "h-stagehand",
"framework_track": "historical"
```

AgentLab reports the same information in its smoke marker, together with the
resolved browser build:

```json
{"framework_version": "0.4.2",
 "companion_versions": {"browsergym": "0.14.2"},
 "browser_build": {"executable_path": null, "source": "framework-bundled-chromium",
                   "system_chrome_detected": "/Applications/Google Chrome.app/..."}}
```

`executable_path: null` with `source: framework-bundled-chromium` is the
intended state: the adapter no longer injects a machine-specific Chrome, so all
arms share one frozen browser build. The system Chrome is reported for
diagnostics only.

### The Stagehand result is a finding, not a pass

Stagehand reached `/books/book` with a passing oracle, but one of the two steps
needed the harness's visible-locator fallback. Under the corrected semantics
that is `framework-fallback` / `test-failure`, not `completed`.

Consequence: **`hybrid-stagehand-grounded-candidate` is not ready to be a
matched arm.** The Stagehand+Qwen path does not currently achieve model-only
grounding on this task, and any earlier Stagehand result recorded as
`completed` would have been inflated by the fallback.

### Redaction confirmed in the record

Browser Use's trace stores action class and length, never the value:

```json
{"type":"input","index":2,"text_redacted":true,"text_length":22}
```

## Track L (upstream latest)

| Framework | Environment | Resolved | Outcome |
|---|---|---|---|
| browser-use | `l-browser-use` | 0.13.10 | **collapsed-to-historical** — upstream latest equals the frozen version, so there is no second stratum |
| agentlab / browsergym | `l-agentlab` | 0.4.2 | **collapsed-to-historical** — same reason |
| stagehand | `l-stagehand` | **4.1.0** | installed, but **adapter-incompatible** |

### Why Stagehand 4.1.0 cannot be used yet

Importing the installed Track L entry shows:

- the package is ESM-only (`exports["."].import = ./dist/index.mjs`) and cannot
  be resolved through `require.resolve`;
- export count falls from **89 (3.0.8) to 30 (4.1.0)**;
- **`LLMClient` is no longer exported** — the base class that
  `scripts/stagehand-qwen-client.mjs` extends;
- `AgentProvider` is also gone.

So the latest Stagehand track cannot run the existing Qwen client. A
v4-compatible client is required before this track can be exercised. This is
recorded in the manifest as `adapter_compatibility.status = incompatible`.

## Readiness gate result

`npm run frameworks:readiness`:

```json
{"ready": 4, "collapsed-to-historical": 2}
```

Ready: `h-browser-use`, `h-agentlab`, `h-stagehand`, `l-stagehand`.
Collapsed: `l-browser-use`, `l-agentlab`.

The gate is fail-closed on three conditions: importable, version-exact against
the manifest, and browser-resolvable.

## What the framework layer can and cannot support today

| Claim | Supported? |
|---|---|
| The 2026-09-09 Browser Use and AgentLab results are reproducible | **yes** — rebuilt environments, version-exact |
| The native three-arm comparison is unaffected by these changes | **yes** — no native driver semantics changed except added failure categories |
| A Stagehand matched arm can be run | **no** — the Qwen path needs the harness fallback, so it is not model-grounded |
| A latest-version stratum exists for Browser Use or AgentLab | **no** — upstream latest equals the frozen version |
| A latest-version Stagehand stratum can be run | **no** — 4.x removed `LLMClient`; a v4 client is required first |

## Next work

1. Write a Stagehand v4-compatible Qwen client, then re-run a model-only smoke.
2. Fix F-04/F-05 (tool-result parts, fail-open response coercion) in the v3
   client, which may remove the need for the fallback at all.
3. Give the AgentLab and Stagehand smoke markers a ledger consumer (F-13).
4. Unify the three adapter oracles into one shared module (F-14).
