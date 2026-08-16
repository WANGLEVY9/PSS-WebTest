import { spawn } from 'node:child_process';
import process from 'node:process';

const action = process.argv[2];
if (!['apply', 'remove'].includes(action)) {
  console.error('Usage: node scripts/bookstack-fault.mjs <apply|remove>');
  process.exit(2);
}

const triggerName = 'pss_corrupt_page_content';
const sql = action === 'apply'
  ? `DROP TRIGGER IF EXISTS ${triggerName}; CREATE TRIGGER ${triggerName} BEFORE UPDATE ON pages FOR EACH ROW SET NEW.html = IF(NEW.name = 'PSS Phase2 Page', '<p>PSS Persisted Content Corrupted</p>', NEW.html), NEW.text = IF(NEW.name = 'PSS Phase2 Page', 'PSS Persisted Content Corrupted', NEW.text);`
  : `DROP TRIGGER IF EXISTS ${triggerName};`;

const child = spawn('docker', ['exec', '-i', 'bookstack-db-1', 'mysql', '-u', 'root', '-proot', 'bookstack', '-e', sql], {
  stdio: ['ignore', 'inherit', 'inherit']
});
const exitCode = await new Promise((resolvePromise, reject) => {
  child.on('error', reject);
  child.on('close', resolvePromise);
});
if (exitCode !== 0) throw new Error(`BookStack fault ${action} exited with ${exitCode}`);
console.log(JSON.stringify({ application: 'bookstack', fault: 'persistence-mismatch', action, trigger: triggerName }));
