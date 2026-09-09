# Persistent replay evidence contract

The Phase 2 runners now write a local replay manifest beside every run record under `artifacts/phase2/replays/`. The directory is intentionally ignored by Git because screenshots can contain local application data.

Each frame contains:

- `filename` and `screenshot_digest`: the persisted JPEG and its SHA-256 digest;
- `phase`, `step`, `url`, and a redacted action (`type` actions retain only length);
- `state`: route milestone plus bounded booleans for authentication, title visibility/fill, editor visibility/focus, save visibility/click, and saved-page visibility;
- `provider_event_ids`: links to the bounded provider-response summaries associated with that observation.

The manifest-level `provider_events` array records provider/model, HTTP status, attempt, finish reason, tool/text presence, lengths, and SHA-256 digests of content/arguments. It never stores prompts, image base64, raw provider content, typed values, credentials, or evaluator state.

The local dashboard reads the manifest and exposes the frames, state milestones, screenshot digest prefixes, provider-event counts, and replay images through `/api/runs/:runId` and the live dossier. The compact JSONL run record remains the immutable statistical ledger; replay files are audit evidence and do not change strict-pass admission.

The committed smoke summary in `phase2-replay-audit-smoke-2026-09-09.json` reports the real post-instrumentation BookStack run IDs and explicitly labels them exploratory rather than admitted or confirmatory evidence.
