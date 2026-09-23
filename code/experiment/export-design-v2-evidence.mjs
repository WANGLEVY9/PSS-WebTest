import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadActiveDesign} from '../analysis/study-design.mjs';
const code=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),{design,sha256}=loadActiveDesign();
const r=JSON.parse(fs.readFileSync(path.join(code,'artifacts/local-runtime/sponsor-verification.json')));
if(r.active_study?.design_sha256!==sha256||r.model_requests!==0||r.benchmark_executions!==0) throw Error('Matching offline v2 verification required');
const dir=process.argv[2];if(!/^study-v2-official-preflight-[\w-]+$/.test(dir||'')) throw Error('Supply an official preflight directory basename');
const p=JSON.parse(fs.readFileSync(path.join(code,'artifacts/local-runtime',dir,'report.json')));
if(p.protocol_id!==design.protocol_id || p.design_sha256!==sha256 || p.benchmark_executions!==0) throw Error('Preflight provenance mismatch');
const report={kind:'MANUSCRIPT_V2_MIGRATION_VERIFICATION',protocol_id:design.protocol_id,design_sha256:sha256,
  observed_at:new Date().toISOString(),passed:r.passed,checks:r.checks,source_files:r.source_files,
  official_input_preflight:{task_id:p.task_id,source_commit:p.official_source_commit,input_sha256:p.input_sha256,
    scope:p.scope,input_export_passed:p.input_export_passed,configurations:p.configurations,rounds:p.rounds,scheduled_not_dispatched:p.scheduled_not_dispatched,
    runtime_binding_ready:p.runtime_binding_readiness.ready,execution_allowed:p.execution_gate.allowed},
  data_status:design.data_status,model_requests:0,new_benchmark_executions:0,confirmatory_authorized:false,
  formula_fix:'RQ3 alternative correctness minus visual correctness; regression-tested positive and negative cases',
  scope_note:'Schedule stress test and synthetic pipeline checks are software verification, not new empirical observations; global collected count remains uninferred'};
const file=path.join(code,'../results/local-runtime',`${report.observed_at.slice(0,10)}-design-v2-verification.json`);
fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({file:path.basename(file),passed:r.passed,new_benchmark_executions:0}));
