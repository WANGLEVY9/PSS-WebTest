import { spawn } from 'node:child_process';
import process from 'node:process';

const action = process.argv[2];
if (!['apply', 'remove'].includes(action)) {
  console.error('Usage: node scripts/indico-fault.mjs <apply|remove>');
  process.exit(2);
}

// Functional fault: only the designated study title is changed.  The trigger
// runs before INSERT/UPDATE, leaving all unrelated events untouched.  The
// independent oracle still expects the original title and must therefore fail.
const functionName = 'pss_phase2_event_title_mismatch';
const triggerName = 'pss_phase2_event_title_mismatch_trigger';
const sql = action === 'apply'
  ? `CREATE OR REPLACE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.title = 'PSS Phase2 Event' THEN NEW.title := NEW.title || ' [FAULT]'; END IF; RETURN NEW; END; $$; DROP TRIGGER IF EXISTS ${triggerName} ON events.events; CREATE TRIGGER ${triggerName} BEFORE INSERT OR UPDATE OF title ON events.events FOR EACH ROW EXECUTE FUNCTION ${functionName}();`
  : `DROP TRIGGER IF EXISTS ${triggerName} ON events.events; DROP FUNCTION IF EXISTS ${functionName}();`;

const child = spawn('docker', [
  'exec', '-i', 'indico-postgres-1', 'psql', '-v', 'ON_ERROR_STOP=1',
  '-U', 'indico', '-d', 'indico', '-c', sql
], { stdio: ['ignore', 'inherit', 'inherit'] });
const exitCode = await new Promise((resolve, reject) => {
  child.on('error', reject);
  child.on('close', resolve);
});
if (exitCode !== 0) throw new Error(`Indico fault ${action} exited with ${exitCode}`);
console.log(JSON.stringify({
  application: 'indico',
  fault: 'event-title-mismatch',
  action,
  trigger: triggerName,
  reversible: true,
  scope: 'title=PSS Phase2 Event only'
}));

