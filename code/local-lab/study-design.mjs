import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const configRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../config');
export const digest=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
export function configurations(design) {
  return [...design.models.flatMap((m,i)=>design.agent_configurations_per_model.map(a=>({id:`${a.prefix}${i+1}`,model_id:m.id,model_label:m.label,framework:a.framework,input:a.input}))),{id:'s',model_id:null,model_label:null,framework:'playwright',input:'scripted'}];
}
export function validateDesign(d) {
  const errors=[],check=(ok,msg)=>{if(!ok)errors.push(msg);};
  check(d?.protocol_id==='pss-manuscript-v2.0','Active manuscript protocol required');
  check(JSON.stringify(d?.benchmarks?.map(b=>[b.id,b.selected_tasks]))===JSON.stringify([['wav',600],['vwa',700],['ata',112]]),'Selected denominators must be 600/700/112');
  check(d?.benchmarks?.[2]?.expected_pass===56&&d?.benchmarks?.[2]?.expected_fail===56,'ATA reference-class counts must be 56/56');
  check(JSON.stringify(d?.models?.map(m=>m.label))===JSON.stringify(['GPT-6 Astra','GPT-5.6 Sol','Qwen3.8-Max','Qwen3.8-Flash','Claude Sonnet 5','Gemini 3.8 Flash']),'Model labels/order must match adopted manuscript');
  check(JSON.stringify(d?.agent_configurations_per_model?.map(c=>[c.prefix,c.framework,c.input]))===JSON.stringify([['v','agentlab-browsergym','visual'],['h','agentlab-browsergym','hybrid'],['u','browser-use-restricted','hybrid']]),'Framework/input crossing differs from manuscript');
  check(d?.script?.id==='s'&&d?.script?.shared_across_models===true&&d?.script?.model===null,'Shared model-free script required');
  check(JSON.stringify(d?.rounds?.discovery)==='["D1","D2"]'&&JSON.stringify(d?.rounds?.validation)===JSON.stringify(Array.from({length:10},(_,i)=>`V${i+1}`)),'D1-D2 and V1-V10 required');
  check(JSON.stringify(d?.rounds?.retry_windows)===JSON.stringify([['V1','V2','V3','V4','V5'],['V6','V7','V8','V9','V10']])&&d?.rounds?.retry_min_joint===8,'Retry window/gate mismatch');
  check(d?.scale?.tasks===1412&&d?.scale?.configurations===19&&d?.scale?.rounds_per_task_configuration===12&&d?.scale?.scheduled_opportunities===321936,'Schedule arithmetic mismatch');
  check(d?.selection?.reviewers===2&&d?.selection?.outcome_blind===true&&d?.selection?.adaptation_failure_remains_in_denominator===true,'Selection/fairness contract missing');
  check(d?.boundaries?.fixed_actor===true&&d?.boundaries?.auxiliary_feedback_to_actor===false,'Actor isolation missing');
  check(d?.budget_policy?.inherit_legacy_local_24_steps_240_seconds===false,'Legacy budget cannot silently replace actual collection settings');
  check(d?.new_execution_authorized===false,'Design adoption alone must not authorize environment execution');
  return errors;
}
export function loadActiveDesign() {
  const pointer=JSON.parse(fs.readFileSync(path.join(configRoot,'active-study-design.json')));
  if(pointer.active_contract!=='study-design-contract.v2.0.json') throw Error('Unsupported or stale active study pointer');
  const raw=fs.readFileSync(path.join(configRoot,pointer.active_contract),'utf8'),design=JSON.parse(raw),errors=validateDesign(design);
  if(errors.length) throw Error(errors.join('; '));
  return {design,sha256:digest(design),source_file_sha256:digest(raw),configurations:configurations(design)};
}
export function studyStatus() {
  const {design,sha256,source_file_sha256,configurations:cs}=loadActiveDesign();
  return {protocol_id:design.protocol_id,design_sha256:sha256,source_file_sha256,configuration_count:cs.length,configurations:cs,rounds:design.rounds,scale:design.scale,data_status:design.data_status,new_execution_authorized:false};
}
