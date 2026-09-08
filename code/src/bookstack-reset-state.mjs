import { sha256 } from './phase2-provenance.mjs';

export const BOOKSTACK_RESET_CONTRACT = 'bookstack-seeded-state-digest-v1';

/**
 * Turn the deliberately small, read-only database snapshot emitted by the
 * lifecycle script into a stable reset-state digest. The snapshot contains
 * only test-fixture identifiers and labels; no credentials are retained.
 */
export function digestBookStackSeedSnapshot(rawSnapshot) {
  if (typeof rawSnapshot !== 'string') throw new Error('BookStack seed snapshot must be text');
  const rows = rawSnapshot.split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  if (!rows.length) throw new Error('BookStack seed snapshot must contain at least one row');
  if (rows.some((row) => !/^(users|books|pages)\|/.test(row))) {
    throw new Error('BookStack seed snapshot has an unexpected row type');
  }
  return sha256({ contract: BOOKSTACK_RESET_CONTRACT, rows: [...new Set(rows)].sort() });
}
