# Experiment implementation

The [code architecture](../ARCHITECTURE.md) is the maintained map for this directory. This folder contains the guarded experiment implementation and its offline checks. The next operator campaign is WAV-only; the older three-benchmark manuscript contract remains separate.

| Layer | Main modules |
| --- | --- |
| Runtime and records | `runtime_store.py`, `runtime_worker.py` |
| Input and identity | `runtime_inputs.py`, `runtime_identity.py`, `benchmark_task_session.py` |
| Framework adapters | `framework_agentlab.py`, `framework_browser_use.py`, `native_framework_driver.py` |
| WAV environment and evaluation | `wav_owned_lifecycle.py`, `wav_native_evaluate.py`, `wav_official_acceptance_probe.py` |
| Provider and spend limits | `provider.mjs`, `model-routing.mjs`, `spend-guard.mjs`, `spend_guard.py` |
| Analysis and review | `../analysis/` contains the protocol and analysis modules |
| Offline verification | `sponsor-portable-verify.mjs`, `validate-current-campaign.mjs` |

`run_wav_qwen_pair.py` and `tools/merge-wav-qwen-pair.mjs` support WAV development diagnostics. They do not implement the complete 120-task GPT dispatcher. VWA and ATA modules remain only as shared historical manuscript analysis and native evaluation references; they are not next-campaign operators.

Run the source-only suite from `code/` with `npm run sponsor:verify:portable -- --python python3 --output artifacts/local-runtime/NEW_NAME`. Use a new name every time. This does not call a model or execute official tasks. Read the report's group counts and `native_acceptance` field before interpreting it.
