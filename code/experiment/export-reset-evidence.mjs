import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {resetProgress} from './reset-evidence.mjs';
import {parseDfKilobytes} from './provisioning-contract.mjs';
const code=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const expected=JSON.parse(fs.readFileSync(path.join(code,'config/benchmark-artifact-manifest.v1.0.json')))
  .mandatory_core.find(b=>b.id==='webarena-verified').environment.candidate_image.reference;
const progress=resetProgress(path.join(code,'artifacts/local-runtime'),expected);
if(!progress.artifact || progress.status==='running') throw Error('Refuse final evidence export: no terminal reset report');
const raw=JSON.parse(fs.readFileSync(path.join(code,'artifacts/local-runtime',progress.artifact)));
let cleanup=null,availableBytes=null;
try {
  const r=JSON.parse(fs.readFileSync(path.join(code,'artifacts/local-runtime/retired-clones-summary.json')));
  cleanup={at:r.at,removed:r.removed.map(x=>x.name),retained:r.retained,
    recovery:r.recovery,log_capture:'docker logs stdout archived; stderr completeness not asserted'};
  availableBytes=parseDfKilobytes(execFileSync('colima',['ssh','--profile','webarena-x86','--','df','-Pk','/var/lib/docker'],{encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']}));
} catch {}
const report={kind:'SCOPED_RESET_PREFLIGHT_EVIDENCE',observed_at:new Date().toISOString(),
  confirmatory_authorized:false,agent_executions:0,model_requests:0,...progress,
  source_sha256:raw.source_sha256,expected_image:expected,tables:raw.tables,
  initial:raw.initial||null,cycles:raw.cycles,primary_before:raw.primary_before,
  owned_clone_cleanup:cleanup,vm_available_bytes_after_cleanup:availableBytes,
  primary_unchanged:raw.primary_unchanged,final_container_stopped:raw.final_container_stopped,
  failure:raw.error||null,events:raw.events,homepage_observations:raw.homepage_observations||[],
  limitations:['Review-related table reset only; no complete benchmark or task-scope admission',
    'No runner per-arm reset implementation or permission to bypass execution gate',
    'Local x86 QEMU environment, not native x86 hardware performance evidence']};
fs.writeFileSync(path.join(code,'../results/local-runtime/2026-09-21-reset-cycles.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
