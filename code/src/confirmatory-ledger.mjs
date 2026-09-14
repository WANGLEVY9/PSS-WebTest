import fs from 'node:fs';
import path from 'node:path';
import { validateRunRecord } from './run-records.mjs';

/**
 * Append one v1.0 record only after an explicit frozen-manifest authorization.
 * The writer is intentionally separate from the pilot append helper so a
 * legacy/local runner cannot silently enter the confirmatory denominator.
 */
export function appendAuthorizedConfirmatoryRecord(record, authorization, outputPath) {
  if (!authorization || authorization.confirmatory_authorized !== true) throw new Error('confirmatory authorization is required before writing a v1.0 record');
  if (authorization.status !== 'frozen-confirmatory-authorized') throw new Error('authorization status must be frozen-confirmatory-authorized');
  if (!/^[a-f0-9]{64}$/.test(authorization.manifest_hash ?? '')) throw new Error('authorization manifest_hash must be a SHA-256 hex digest');
  if (typeof authorization.authorized_at !== 'string' || !authorization.authorized_at.trim()) throw new Error('authorization authorized_at is required');
  const validated = validateRunRecord(record);
  if (validated.schema_version !== '1.0') throw new Error('confirmatory ledger accepts only schema_version 1.0');
  if (!outputPath) throw new Error('confirmatory output path is required');
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.appendFileSync(outputPath, `${JSON.stringify(validated)}\n`, { mode: 0o600 });
  return validated;
}
