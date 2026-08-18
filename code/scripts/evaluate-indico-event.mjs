import { spawn } from 'node:child_process';
import process from 'node:process';

const expectedTitle = process.env.PSS_INDICO_EVENT_TITLE ?? 'PSS Phase2 Event';
const dateInput = process.env.PSS_INDICO_EVENT_DATE ?? '15/01/2030';
const creatorEmail = process.env.PSS_INDICO_EMAIL ?? 'pss-phase2-indico@admin.com';
const expectFault = process.env.PSS_INDICO_EXPECT_FAULT === '1';
const dateParts = dateInput.split('/');
if (dateParts.length !== 3 || dateParts.some((part) => !/^\d+$/.test(part))) {
  throw new Error('PSS_INDICO_EVENT_DATE must use DD/MM/YYYY');
}
const expectedDate = `${dateParts[2].padStart(4, '0')}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
if (!/^[A-Za-z0-9 ._-]+$/.test(expectedTitle)) throw new Error('PSS_INDICO_EVENT_TITLE contains unsupported characters');
if (!/^[A-Za-z0-9._%+@-]+$/.test(creatorEmail)) throw new Error('PSS_INDICO_EMAIL contains unsupported characters');

const titlePredicate = expectFault
  ? `title='${expectedTitle} [FAULT]'`
  : `title='${expectedTitle}'`;
const query = `SELECT COUNT(*) FROM events.events WHERE ${titlePredicate} AND start_dt::date='${expectedDate}' AND end_dt::date='${expectedDate}' AND type=1 AND is_deleted=false AND creator_id IN (SELECT user_id FROM users.emails WHERE email='${creatorEmail}') AND category_id=0 AND protection_mode IN (0, 1);`;
const child = spawn('docker', ['exec', '-i', 'indico-postgres-1', 'psql', '-At', '-U', 'indico', '-d', 'indico', '-c', query], {
  stdio: ['ignore', 'pipe', 'inherit']
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk; });
const exitCode = await new Promise((resolvePromise, reject) => {
  child.on('error', reject);
  child.on('close', resolvePromise);
});
if (exitCode !== 0) throw new Error(`Indico oracle query exited with ${exitCode}`);

const matches = Number(output.trim());
const result = {
  application: 'indico',
  oracle: 'relational-event-state',
  title: expectedTitle,
  expected_date: expectedDate,
  matches,
  expected_fault: expectFault,
  passed: matches === 1,
  evaluated_at: new Date().toISOString()
};
console.log(JSON.stringify(result));
if (!result.passed) process.exitCode = 1;
