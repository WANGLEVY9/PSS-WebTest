import { spawn } from 'node:child_process';
import process from 'node:process';

const expectedTitle = process.env.PSS_BOOKSTACK_PAGE_TITLE ?? 'PSS Phase2 Page';
const expectedContent = process.env.PSS_BOOKSTACK_PAGE_CONTENT ?? 'PSS Phase2 Content';
const expectedBookSlug = process.env.PSS_BOOKSTACK_BOOK_SLUG ?? 'book';

for (const [name, value] of [['title', expectedTitle], ['content', expectedContent]]) {
  if (!/^[A-Za-z0-9 ._-]+$/.test(value)) {
    throw new Error(`${name} contains unsupported characters for the fixed pilot oracle`);
  }
}

const query = `SELECT COUNT(*) FROM pages p JOIN books b ON b.id=p.book_id WHERE p.name='${expectedTitle}' AND p.html LIKE '%${expectedContent}%' AND b.slug='${expectedBookSlug}' AND p.draft=0;`;
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
const matches = Number(output.trim());
const result = {
  application: 'bookstack',
  oracle: 'persisted-state',
  title: expectedTitle,
  book_slug: expectedBookSlug,
  matches,
  passed: matches === 1,
  evaluated_at: new Date().toISOString()
};
console.log(JSON.stringify(result));
if (!result.passed) process.exitCode = 1;
