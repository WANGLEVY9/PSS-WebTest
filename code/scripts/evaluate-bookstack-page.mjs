import { spawn } from 'node:child_process';
import process from 'node:process';
import { classifyBookStackPersistence } from '../src/oracles/bookstack-persistence.mjs';

const expectedTitle = process.env.PSS_BOOKSTACK_PAGE_TITLE ?? 'PSS Phase2 Page';
const expectedContent = process.env.PSS_BOOKSTACK_PAGE_CONTENT ?? 'PSS Phase2 Content';
const expectedBookSlug = process.env.PSS_BOOKSTACK_BOOK_SLUG ?? 'book';
const faultMarker = process.env.PSS_BOOKSTACK_FAULT_MARKER ?? 'PSS Persisted Content Corrupted';
const expectedVerdict = process.env.PSS_EXPECTED_VERDICT ?? 'clean';

for (const [name, value] of [['title', expectedTitle], ['content', expectedContent], ['fault marker', faultMarker]]) {
  if (!/^[A-Za-z0-9 ._-]+$/.test(value)) {
    throw new Error(`${name} contains unsupported characters for the fixed pilot oracle`);
  }
}
if (!['clean', 'fault'].includes(expectedVerdict)) throw new Error('PSS_EXPECTED_VERDICT must be clean or fault');

const query = `SELECT COUNT(*), COALESCE(SUM(p.html LIKE '%${expectedContent}%'), 0), COALESCE(SUM(p.html LIKE '%${faultMarker}%' OR p.text LIKE '%${faultMarker}%'), 0) FROM pages p JOIN books b ON b.id=p.book_id WHERE p.name='${expectedTitle}' AND b.slug='${expectedBookSlug}' AND p.draft=0;`;
const child = spawn('docker', ['exec', '-i', 'bookstack-db-1', 'mysql', '-N', '-B', '-u', 'admin', '-padmin', 'bookstack', '-e', query], {
  stdio: ['ignore', 'pipe', 'inherit']
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk; });
const exitCode = await new Promise((resolvePromise, reject) => {
  child.on('error', reject);
  child.on('close', resolvePromise);
});

if (exitCode !== 0) throw new Error(`BookStack oracle query exited with ${exitCode}`);
const counts = output.trim().split(/\s+/).map(Number);
if (counts.length !== 3 || counts.some((value) => !Number.isInteger(value) || value < 0)) throw new Error('BookStack oracle returned invalid aggregate counts');
const classification = classifyBookStackPersistence({ candidateCount: counts[0], cleanMatches: counts[1], faultMatches: counts[2], expectedVerdict });
const result = {
  application: 'bookstack',
  oracle: 'persisted-state',
  title: expectedTitle,
  book_slug: expectedBookSlug,
  fault_marker: faultMarker,
  // Retained for historical clean-state gates; it is the number of clean
  // persisted matches, not a proxy for fault detection.
  matches: classification.clean_matches,
  ...classification,
  evaluated_at: new Date().toISOString()
};
console.log(JSON.stringify(result));
if (!result.passed) process.exitCode = 1;
