// A small OFFICIAL task input/schedule check, NOT an agent execution or synthetic result.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadActiveDesign,digest} from './study-design.mjs';
import {schedulePlan,bindingReadiness} from './study-pipeline.mjs';
import {currentExecutionGate} from './execution-gate.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),code=path.resolve(root,'..'),{design}=loadActiveDesign();
const selection=JSON.parse(fs.readFileSync(path.join(root,'benchmark-selection.json')));
const source=path.join(code,'artifacts/benchmark-snapshots/webarena-verified');
const head=execFileSync('git',['-C',source,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(head!==selection.source_commit || execFileSync('git',['-C',source,'status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim()) throw Error('Official source must match clean pinned checkout');
const dir=fs.mkdtempSync(path.join(code,'artifacts/local-runtime/study-v2-official-preflight-'));
const taskId=selection.task_ids[0],file=path.join(dir,'agent-inputs.json');
execFileSync(path.join(code,'.venv-benchmark/bin/webarena-verified'),['agent-input-get','--config',path.join(root,'benchmark-config.json'),'--task-ids',String(taskId),'--output',file],{stdio:'pipe',timeout:30000});
const raw=fs.readFileSync(file,'utf8'),inputs=JSON.parse(raw);
if(inputs.length!==1 || inputs[0].task_id!==taskId || !inputs[0].intent || inputs[0].sites.length!==1) throw Error('Unexpected official exported input');
const task={task_key:`wav:${inputs[0].sites[0]}:${taskId}`,benchmark:'wav',application:inputs[0].sites[0],official_task_id:String(taskId),source_sha256:digest(raw),source_commit:head,template_id:inputs[0].intent_template_id};
const bundle={protocol_id:design.protocol_id,scope:'diagnostic',tasks:[task],records:[]},plan=schedulePlan(design,bundle.tasks,{scope:'diagnostic'});
fs.writeFileSync(path.join(dir,'bundle.json'),JSON.stringify(bundle,null,2)+'\n',{flag:'wx',mode:0o600});
const gate=currentExecutionGate(),bindings=bindingReadiness(design,null);
const report={kind:'OFFICIAL_TASK_INPUT_AND_SCHEDULE_PREFLIGHT',protocol_id:design.protocol_id,task_id:taskId,
  official_source_commit:head,input_sha256:digest(raw),scope:'development-exposed-nonformal',input_export_passed:true,
  configurations:plan.configurations,rounds:plan.rounds,scheduled_not_dispatched:plan.scheduled,
  design_sha256:plan.design_sha256,selection_sha256:plan.selection_sha256,schedule_sha256:plan.schedule_sha256,
  runtime_binding_readiness:bindings,execution_gate:gate,model_requests:0,benchmark_executions:0,
  interpretation:'Official input and schedule integration only; no model/framework task success evidence'};
fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({...report,artifact_directory:dir},null,2));
