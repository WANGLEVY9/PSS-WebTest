import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;
const CREDENTIAL_PATTERN = /(sk-[A-Za-z0-9_-]{12,}|bearer\s+[A-Za-z0-9._-]{12,}|api[_-]?key\s*[=:]\s*\S+|password\s*[=:]\s*\S+)/ig;

function safeSegment(value, label) {
  if (typeof value !== 'string' || !SAFE_SEGMENT.test(value)) throw new Error(`${label} contains unsupported characters`);
  return value;
}

export function sanitizeReplayAction(action = {}) {
  const type = String(action.type ?? 'unknown');
  const safe = { type };
  if (['click', 'double_click'].includes(type)) {
    if (Number.isFinite(action.x)) safe.x = Math.round(action.x);
    if (Number.isFinite(action.y)) safe.y = Math.round(action.y);
  }
  if (type === 'keypress' && typeof action.key === 'string') safe.key = action.key.slice(0, 32);
  if (type === 'scroll' && Number.isFinite(action.delta_y)) safe.delta_y = Math.round(action.delta_y);
  if (type === 'wait' && Number.isFinite(action.ms)) safe.ms = Math.round(action.ms);
  // Typed values can contain task-specific data.  A replay needs to convey
  // the interaction class, not reproduce potentially sensitive text.
  if (type === 'type') {
    safe.text_redacted = true;
    safe.text_length = typeof action.text === 'string' ? action.text.length : null;
  }
  return safe;
}

function sanitizeError(error) {
  if (!error) return null;
  const message = String(error.message ?? error).replace(CREDENTIAL_PATTERN, '[redacted]').slice(0, 280);
  return { name: String(error.name ?? 'Error').slice(0, 80), message };
}

function digest(value) {
  return crypto.createHash('sha256').update(value ?? '').digest('hex');
}

/**
 * Keep only state facts needed for a screenshot audit.  In particular, this
 * deliberately excludes field values, DOM dumps, page structure, and hidden
 * evaluator state.  The booleans make title/editor/save milestones auditable
 * without turning the replay archive into another oracle channel.
 */
export function sanitizeReplayState(state = {}) {
  if (!state || typeof state !== 'object') return null;
  const safe = {};
  for (const key of [
    'milestone', 'url_path', 'title_visible', 'title_filled', 'title_length',
    'editor_visible', 'editor_focused', 'save_visible', 'save_disabled',
    'save_clicked', 'saved_page_visible', 'authenticated', 'request_state'
  ]) {
    if (typeof state[key] === 'boolean' || typeof state[key] === 'string' || Number.isInteger(state[key])) {
      safe[key] = typeof state[key] === 'string' ? state[key].slice(0, 120) : state[key];
    }
  }
  return Object.keys(safe).length ? safe : null;
}

/**
 * Provider evidence is a bounded summary, never the raw response.  Content
 * and tool arguments are represented by length plus SHA-256 so a run can be
 * joined to a provider event without leaking prompts, typed values, or keys.
 */
export function sanitizeProviderSummary(summary = {}) {
  if (!summary || typeof summary !== 'object') return null;
  const safe = {};
  for (const key of ['step', 'attempt', 'http_status', 'content_length', 'arguments_length']) {
    if (Number.isInteger(summary[key])) safe[key] = summary[key];
  }
  for (const key of ['provider', 'model', 'finish_reason', 'tool_name', 'error_class']) {
    if (typeof summary[key] === 'string') safe[key] = summary[key].slice(0, 120);
  }
  for (const key of ['ok', 'has_text_content', 'has_tool_call']) {
    if (typeof summary[key] === 'boolean') safe[key] = summary[key];
  }
  for (const key of ['content_digest', 'arguments_digest']) {
    if (typeof summary[key] === 'string' && /^[a-f0-9]{64}$/i.test(summary[key])) safe[key] = summary[key];
  }
  if (summary.error) safe.error = sanitizeError(summary.error);
  return Object.keys(safe).length ? safe : null;
}

/**
 * Stores replay frames in ignored local artifacts, separate from the compact
 * immutable run record.  The recorder never saves prompts, provider replies,
 * credentials, page structure, or literal typed text.  It is optional
 * instrumentation and never participates in the agent observation contract.
 */
export function createLocalReplayRecorder({
  runId,
  applicationId,
  taskId,
  arm,
  enabled = process.env.PSS_CAPTURE_REPLAY_FRAMES !== '0',
  root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'artifacts', 'phase2', 'replays'),
  maxFrames = Number.parseInt(process.env.PSS_REPLAY_MAX_FRAMES ?? '40', 10)
} = {}) {
  const id = safeSegment(runId, 'runId');
  const safeApplication = safeSegment(applicationId, 'applicationId');
  const safeTask = safeSegment(taskId, 'taskId');
  const safeArm = safeSegment(arm, 'arm');
  const directory = path.join(root, id);
  const frames = [];
  const providerEvents = [];
  let ordinal = 0;
  let providerOrdinal = 0;
  const limit = Number.isInteger(maxFrames) && maxFrames > 0 ? maxFrames : 40;

  function recordProviderEvent(summary) {
    if (!enabled) return null;
    const safe = sanitizeProviderSummary(summary);
    if (!safe || providerEvents.length >= 200) return null;
    const id = `provider-${String(providerOrdinal).padStart(3, '0')}`;
    providerOrdinal += 1;
    providerEvents.push({ id, ...safe });
    return id;
  }

  async function capture({ page, buffer = null, phase, step = null, action = null, state = null, providerEventIds = [] }) {
    if (!enabled || frames.length >= limit || !page || page.isClosed?.()) return null;
    const phaseLabel = safeSegment(String(phase), 'phase');
    const filename = `${String(ordinal).padStart(3, '0')}-${phaseLabel}${Number.isInteger(step) ? `-step-${String(step).padStart(2, '0')}` : ''}.jpg`;
    ordinal += 1;
    try {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      const imageBuffer = buffer ?? await page.screenshot({ type: 'jpeg', quality: 80, animations: 'disabled' });
      fs.writeFileSync(path.join(directory, filename), imageBuffer, { mode: 0o600 });
      const frame = {
        id: `${phaseLabel}-${ordinal - 1}`,
        filename,
        phase: phaseLabel,
        step: Number.isInteger(step) ? step : null,
        url: page.url(),
        action: action ? sanitizeReplayAction(action) : null,
        screenshot_digest: digest(imageBuffer),
        state: sanitizeReplayState(state),
        provider_event_ids: Array.isArray(providerEventIds)
          ? providerEventIds.filter((value) => typeof value === 'string' && /^provider-\d+$/.test(value)).slice(0, 20)
          : []
      };
      frames.push(frame);
      return frame;
    } catch {
      // Instrumentation must not turn a runnable experimental cell into a
      // failure merely because local frame persistence was unavailable.
      return null;
    }
  }

  function finalize({ status, checkpointReached, emittedVerdict, groundTruthVerdict, failureCategory, error = null, oraclePassed = null } = {}) {
    if (!enabled) return null;
    const manifest = {
      schema_version: 'replay-v1',
      run_id: id,
      application_id: safeApplication,
      task_id: safeTask,
      arm: safeArm,
      created_at: new Date().toISOString(),
      outcome: {
        status: status ?? null,
        checkpoint_reached: checkpointReached === true,
        emitted_verdict: emittedVerdict ?? null,
        ground_truth_verdict: groundTruthVerdict ?? null,
        failure_category: failureCategory ?? null,
        oracle_passed: oraclePassed === true,
        error: sanitizeError(error)
      },
      frames,
      provider_events: providerEvents
    };
    try {
      fs.mkdirSync(root, { recursive: true, mode: 0o700 });
      fs.writeFileSync(path.join(root, `${id}.json`), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
      return manifest;
    } catch {
      return null;
    }
  }

  return {
    capture,
    recordProviderEvent,
    finalize,
    get frames() { return [...frames]; },
    get providerEvents() { return [...providerEvents]; }
  };
}
