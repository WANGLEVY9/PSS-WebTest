// No provider calls, SUT mutation, or implicit cloud access. Imports preserve source bytes.
import fs from 'node:fs';
import path from 'node:path';
import {loadActiveDesign,digest} from './study-design.mjs';
import {schedulePlan,bindingReadiness,reconcile,recordsToAnalysis} from './study-pipeline.mjs';
import {preparationSummary,executionResourceSummary} from './study-observability.mjs';
const [command,inputFile,outDir]=process.argv.slice(2);
if(!['plan','import'].includes(command)||!inputFile||!outDir||process.argv.length!==5) throw Error('Usage: node local-lab/study-workflow.mjs plan|import INPUT.json NEW_OUTPUT_DIRECTORY');
const raw=fs.readFileSync(inputFile,'utf8'),bundle=JSON.parse(raw),{design}=loadActiveDesign();
if(bundle.protocol_id!==design.protocol_id) throw Error('Bundle must explicitly map to the active manuscript design');
if(!['formal','diagnostic','synthetic'].includes(bundle.scope)) throw Error('Explicit scope required');
const options={scope:bundle.scope,bindings:bundle.bindings||null},plan=schedulePlan(design,bundle.tasks,options),runtime=bindingReadiness(design,bundle.bindings);
let coverage,analysis,observability;
if(command==='import') {
  if(!Array.isArray(bundle.records)) throw Error('Normalized records required; summary tables cannot substitute for opportunity records');
  coverage=reconcile(design,bundle.tasks,bundle.records,options);
  if(bundle.records.length) analysis=recordsToAnalysis(design,bundle.tasks,bundle.records,options).report;
  observability={preparation:preparationSummary(bundle.preparation||[]),preparation_data_supplied:Array.isArray(bundle.preparation),execution:executionResourceSummary(bundle.records)};
}
// Validate first, then create a new immutable evidence directory; never overwrite source/output.
fs.mkdirSync(outDir,{mode:0o700});
const save=(name,value)=>fs.writeFileSync(path.join(outDir,name),JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});
fs.copyFileSync(inputFile,path.join(outDir,'source-bundle.json'),fs.constants.COPYFILE_EXCL);fs.chmodSync(path.join(outDir,'source-bundle.json'),0o600);
const summary={kind:bundle.scope==='synthetic'?'SYNTHETIC_PIPELINE_CHECK':'MANUSCRIPT_DESIGN_RECONCILIATION',protocol_id:design.protocol_id,
  observed_at:new Date().toISOString(),source_bundle_sha256:digest(raw),scope:bundle.scope,
  ...Object.fromEntries(Object.entries(plan).filter(([k])=>k!=='opportunities')),runtime_binding_readiness:runtime,
  model_requests:0,benchmark_executions:0,new_execution_authorized:false,global_completion_status:'not-inferred-from-local-presence'};
if(command==='plan') {
  const fd=fs.openSync(path.join(outDir,'opportunities.jsonl'),'wx',0o600);
  try {for(const op of plan.opportunities()) fs.writeSync(fd,JSON.stringify({...op,execution_status:'not-dispatched',runtime_ready:runtime.ready})+'\n');}finally{fs.closeSync(fd);}
}
if(coverage)save('coverage.json',coverage);if(analysis)save('analysis.json',analysis);if(observability)save('observability.json',observability);save('report.json',summary);
console.log(JSON.stringify({kind:summary.kind,protocol_id:design.protocol_id,scheduled:plan.scheduled,imported:coverage?.imported??null,not_imported_unknown:coverage?.not_imported_unknown??null,runtime_ready:runtime.ready,new_execution_authorized:false}));
