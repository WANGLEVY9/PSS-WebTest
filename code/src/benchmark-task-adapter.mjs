import crypto from 'node:crypto';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const FORBIDDEN_KEYS = /(evaluator|expected|answer|ground[_-]?truth|oracle|outcome|success|pass|fail|assert)/i;

function rejectPrivilegedFields(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new Error(`benchmark task adapter refuses privileged field: ${path}.${key}`);
    rejectPrivilegedFields(child, `${path}.${key}`);
  }
}

/**
 * Convert a screened source task into the common runner input.  The adapter
 * intentionally requires the verbatim instruction at call time because the
 * outcome-blind inventory stores only its digest.  Evaluator and expected
 * answer material is never allowed through this boundary.
 */
export function buildBenchmarkTaskInput({ sourceTask, instruction, startUrl, screening }) {
  if (!sourceTask || typeof sourceTask !== 'object') throw new Error('sourceTask is required');
  rejectPrivilegedFields(sourceTask);
  if (typeof instruction !== 'string' || !instruction.trim() || instruction.length > 20000) throw new Error('verbatim official instruction is required and must be bounded');
  const instructionDigest = sha256(instruction);
  if (sourceTask.instruction_digest !== instructionDigest) throw new Error('verbatim instruction digest does not match the pinned source task');
  if (!/^[a-f0-9]{40}$/.test(sourceTask.source_commit ?? '')) throw new Error('sourceTask.source_commit must be a SHA-1 commit');
  if (typeof sourceTask.benchmark_id !== 'string' || !sourceTask.benchmark_id.trim()) throw new Error('sourceTask.benchmark_id is required');
  if (typeof sourceTask.task_source_id !== 'string' || !sourceTask.task_source_id.trim()) throw new Error('sourceTask.task_source_id is required');
  if (!screening || screening.adjudicated_decision !== 'yes') throw new Error('task is not adjudicated eligible by the outcome-blind screening ledger');
  if (screening.task_instruction_digest !== instructionDigest) throw new Error('screening digest does not match the source instruction');
  if (!/^[a-f0-9]{64}$/.test(screening.screening_manifest_digest ?? '')) throw new Error('screening_manifest_digest must be a SHA-256 hex digest');
  const urls = Array.isArray(startUrl) ? startUrl : [startUrl];
  if (!urls.length || urls.some((url) => typeof url !== 'string' || !/^https?:\/\//.test(url))) throw new Error('at least one absolute HTTP(S) start URL is required');
  return {
    schema_version: 'benchmark-task-input-v1.0',
    benchmark_id: sourceTask.benchmark_id,
    source_commit: sourceTask.source_commit,
    task_source_id: sourceTask.task_source_id,
    instruction,
    instruction_digest: instructionDigest,
    start_urls: urls,
    site_scope: Array.isArray(sourceTask.sites) ? [...sourceTask.sites] : [],
    require_login: sourceTask.require_login ?? null,
    difficulty: sourceTask.difficulty ?? null,
    screening_manifest_digest: screening.screening_manifest_digest,
    confirmatory_authorized: false
  };
}
