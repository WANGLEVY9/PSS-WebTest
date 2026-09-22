// All rows below are SYNTHETIC_TEST fixtures, not experimental results.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadActiveDesign,validateDesign,configurations,digest} from './study-design.mjs';
import {schedulePlan,validateTasks,validateRecords,reconcile,recordsToAnalysis,bindingReadiness} from './study-pipeline.mjs';
import {preparationSummary,executionResourceSummary} from './study-observability.mjs';
const {design}=loadActiveDesign();
const tasks=()=>['wav','vwa','ata'].map(benchmark=>({task_key:`${benchmark}:fixture`,benchmark,official_task_id:'synthetic-fixture',application:'test-app',source_sha256:'a'.repeat(64),...(benchmark==='wav'?{template_id:'fixture-template'}:{}),...(benchmark==='ata'?{expected:'FAIL'}:{})}));
const rows=()=>[...schedulePlan(design,tasks(),{scope:'synthetic'}).opportunities()].map(op=>({...op,data_kind:'SYNTHETIC_TEST',source_opportunity_id:op.opportunity_id,source_sha256:'b'.repeat(64),configuration_sha256:digest(op.config_id),preparation_status:'prepared',started:true,assessment_status:'valid',budget_met:true,terminal_status:'completed',native_score:op.benchmark==='ata'?null:1,verdict:op.benchmark==='ata'?'FAIL':null,...(op.benchmark==='ata'?{step_class:'AFC'}:{})}));
test('active design fixes six models, 19 configurations, 12 rounds, and keeps deployment separate',()=>{
  assert.deepEqual(validateDesign(design),[]);assert.equal(configurations(design).length,19);assert.equal(1413*19*12,322164);
  const wrong=structuredClone(design);wrong.rounds.retry_min_joint=7;assert.ok(validateDesign(wrong).length);
  assert.equal(bindingReadiness(design,{}).ready,false);assert.equal(design.new_execution_authorized,false);
});
test('preparation is counted once and separate from measured cash or unreported resource data',()=>{
  const p={prep_id:'shared-script',config_id:'s',benchmark:'wav',scope:'shared',measurement_basis:'logged',authoring_minutes:60,debugging_minutes:30,review_minutes:30};
  assert.equal(preparationSummary([p])[0].hours,2);assert.throws(()=>preparationSummary([p,p]),/Unique/);
  assert.equal(preparationSummary([{...p,review_minutes:null}])[0].hours,null);
  const s=executionResourceSummary([{config_id:'v1',started:true,execution_charge_usd:.1},{config_id:'v1',started:true}])[0];
  assert.equal(s.execution_charge_usd.total,null);assert.equal(s.execution_charge_usd.reported_subtotal,.1);assert.equal(s.preparation_included,false);
});
test('runtime binding checks enforce matched budgets and shared models across input/framework arms',()=>{
  const profile={task_timeout_ms:100,max_actions:2,browser_revision:'synthetic-browser',viewport:{width:1280,height:720},locale:'en-US',timezone:'UTC'};
  const b={protocol_id:design.protocol_id,budget_profiles:{same:profile},configurations:Object.fromEntries(configurations(design).map(c=>[c.id,{framework:c.framework,framework_revision:'synthetic-version',model_api_id:c.model_id,provider:c.model_id?'synthetic-provider':null,configuration_sha256:'a'.repeat(64),action_schema_sha256:'a'.repeat(64),boundary_audit_sha256:'a'.repeat(64),prompt_sha256:'a'.repeat(64),image_settings_sha256:'a'.repeat(64),model_settings_sha256:'a'.repeat(64),script_manifest_sha256:'a'.repeat(64),blind_authoring_evidence_sha256:'a'.repeat(64),budget_profile_by_benchmark:{wav:'same',vwa:'same',ata:'same'}}]))};
  for(const value of Object.values(b.configurations)) value.executor_binding_sha256_by_benchmark={wav:'b'.repeat(64),vwa:'c'.repeat(64),ata:'d'.repeat(64)};
  assert.equal(bindingReadiness(design,b).ready,true);
  b.configurations.h1.model_api_id='other';assert.ok(bindingReadiness(design,b).errors.some(e=>e.includes('same model')));b.configurations.h1.model_api_id='m1';
  b.budget_profiles.other={...profile,max_actions:99};b.configurations.h1.budget_profile_by_benchmark.wav='other';assert.ok(bindingReadiness(design,b).errors.some(e=>e.includes('settings differ')));
});
test('schedule is stable, shared script occurs once per task/round, and all discovery precedes validation',()=>{
  const p=schedulePlan(design,tasks(),{scope:'synthetic'}),ops=[...p.opportunities()];assert.equal(ops.length,684);
  assert.equal(p.design_sha256,loadActiveDesign().sha256);
  assert.equal(new Set(ops.map(o=>o.opportunity_id)).size,684);assert.equal(ops.filter(o=>o.config_id==='s').length,36);
  assert.equal(ops.findIndex(o=>o.phase==='validation'),114);
  assert.deepEqual(ops,[...schedulePlan(design,tasks().reverse(),{scope:'synthetic'}).opportunities()]);
  assert.notEqual(p.schedule_sha256,schedulePlan(design,tasks(),{scope:'synthetic',bindings:{version:'different'}}).schedule_sha256);
  assert.throws(()=>validateTasks(design,tasks()),/denominator/);
});
test('full manuscript-sized schedule streams 322164 unique slots without creating results',()=>{
  const ts=design.benchmarks.flatMap(b=>Array.from({length:b.selected_tasks},(_,i)=>({task_key:`${b.id}:${i}`,benchmark:b.id,official_task_id:`fixture-${i}`,application:'fixture',source_sha256:'a'.repeat(64),...(b.id==='wav'?{template_id:i%20}:{}),...(b.id==='ata'?{expected:i<b.expected_pass?'PASS':'FAIL'}:{})})));
  const p=schedulePlan(design,ts);let n=0,s=0;for(const o of p.opportunities()){n++;if(o.config_id==='s')s++;}
  assert.equal(n,322164);assert.equal(s,1413*12);
});
test('data absence means not imported, never global nonexecution or automatic rerun',()=>{
  const r=reconcile(design,tasks(),rows().slice(0,1),{scope:'synthetic'});
  assert.equal(r.imported,1);assert.equal(r.not_imported_unknown,683);assert.equal(r.global_completed_count,null);assert.equal(r.automatically_enqueued,0);
});
test('record contract rejects duplicates, phase rewriting, hidden model changes and synthetic pooling',()=>{
  const r=rows();assert.throws(()=>validateRecords(design,tasks(),[r[0],r[0]]),/duplicate/);
  assert.throws(()=>validateRecords(design,tasks(),[{...r[0],phase:'validation'}]),/allocation/);
  const same=r.find(x=>x.benchmark===r[0].benchmark&&x.config_id===r[0].config_id&&x.round!==r[0].round);assert.throws(()=>validateRecords(design,tasks(),[r[0],{...same,configuration_sha256:'c'.repeat(64)}]),/Configuration changed/);
  assert.throws(()=>validateRecords(design,tasks(),[{...r[0],terminal_status:'evaluator-error'}]),/remain unresolved/);
  assert.throws(()=>recordsToAnalysis(design,tasks(),[r[0],{...r[1],data_kind:'MEASURED'}],{scope:'synthetic'}),/pooled/);
});
test('real-shaped whole pipeline produces 57 configuration strata and correct positive-gain direction',()=>{
  const r=rows();
  for(const row of r) if(row.benchmark==='ata'&&row.config_id==='v1') {row.verdict='PASS';delete row.step_class;}
  const {report}=recordsToAnalysis(design,tasks(),r,{scope:'synthetic'});
  assert.equal(report.strata.length,57);assert.equal(report.strata.find(s=>s.configuration_id==='s'&&s.benchmark==='wav').operational.scheduled,12);
  const p=report.pairs.find(p=>p.benchmark==='ata'&&p.c==='v1'&&p.d==='h1'&&p.error_conditioned.cohort.error_type==='false_pass');
  assert.equal(p.error_conditioned.errors.contrast,1);assert.equal(p.retry.by_reference_class.FAIL.n,1);
});
test('late native success stays native while timeout is operational zero; no-verdict ATA is not unresolved',()=>{
  const r=rows();const x=r.find(r=>r.benchmark==='wav'&&r.config_id==='v1');x.budget_met=false;x.terminal_status='timeout';
  const a=r.find(r=>r.benchmark==='ata'&&r.config_id==='v1');a.verdict=null;a.terminal_status='no-verdict';delete a.step_class;
  const {input}=recordsToAnalysis(design,tasks(),r,{scope:'synthetic'});
  const s=input.strata.find(s=>s.benchmark==='wav'&&s.configuration_id==='v1');assert.equal(s.native_rows.find(v=>v.round===x.round).success,1);assert.equal(s.operational.rows.find(v=>v.round===x.round).correctness,0);
  assert.equal(input.strata.find(s=>s.benchmark==='ata'&&s.configuration_id==='v1').operational.rows.find(v=>v.round===a.round).correctness,0);
});
test('CLI imports records, preserves source bytes and never replaces an existing evidence directory',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pss-v2-pipeline-'));
  try {
    const file=path.join(temp,'bundle.json'),out=path.join(temp,'import');fs.writeFileSync(file,JSON.stringify({protocol_id:design.protocol_id,scope:'synthetic',tasks:tasks(),records:rows()}));
    const args=[fileURLToPath(new URL('./study-workflow.mjs',import.meta.url)),'import',file,out];
    const result=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
    assert.equal(fs.readFileSync(path.join(out,'source-bundle.json'),'utf8'),fs.readFileSync(file,'utf8'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(out,'coverage.json'))).imported,684);
    assert.notEqual(spawnSync(process.execPath,args).status,0);
  } finally{fs.rmSync(temp,{recursive:true});}
});

test('published ATA class imbalance is required and old balanced contracts/records are rejected',()=>{
  const wrong=structuredClone(design);wrong.benchmarks[2].expected_pass=56;wrong.benchmarks[2].expected_fail=56;
  assert.ok(validateDesign(wrong).length);
  const ts=design.benchmarks.flatMap(b=>Array.from({length:b.selected_tasks},(_,i)=>({task_key:`${b.id}:${i}`,benchmark:b.id,official_task_id:`fixture-${i}`,application:'fixture',source_sha256:'a'.repeat(64),...(b.id==='wav'?{template_id:i%20}:{}),...(b.id==='ata'?{expected:i<b.expected_pass?'PASS':'FAIL'}:{})})));
  assert.doesNotThrow(()=>validateTasks(design,ts));
  ts.find(t=>t.benchmark==='ata'&&t.expected==='PASS').expected='FAIL';
  assert.throws(()=>validateTasks(design,ts),/published benchmark/);
  assert.throws(()=>validateRecords(design,tasks(),[{...rows()[0],protocol_id:'pss-manuscript-v2.0'}]),/Historical acquisition/);
});

test('original execution cannot populate two arms and schedule drift is rejected',()=>{
  const r=rows();
  assert.throws(()=>validateRecords(design,tasks(),[r[0],{...r[1],source_opportunity_id:r[0].source_opportunity_id}]),/Original execution reused/);
  assert.throws(()=>validateRecords(design,tasks(),[{...r[0],schedule_sha256:'f'.repeat(64)}]),/schedule identity/);
  const other=schedulePlan(design,tasks(),{scope:'synthetic',seed:'other-campaign'});
  const op=[...other.opportunities()][0];
  assert.throws(()=>recordsToAnalysis(design,tasks(),[{...r[0],...op}],{scope:'synthetic'}),/selected campaign/);
});

test('known actor timeout is operational zero even if native evaluation is unresolved',()=>{
  const r={...rows().find(r=>r.benchmark==='wav'),native_score:null,verdict:null,assessment_status:'unresolved',terminal_status:'evaluator-error',actor_terminal_status:'timeout',budget_met:false};
  const {input}=recordsToAnalysis(design,tasks(),[r],{scope:'synthetic'});
  const s=input.strata.find(s=>s.benchmark===r.benchmark&&s.configuration_id===r.config_id);
  assert.equal(s.operational.rows[0].correctness,0);
  assert.equal(s.native_rows[0].success,null);
  const unknown={...r,actor_terminal_status:null,budget_met:null};
  const next=recordsToAnalysis(design,tasks(),[unknown],{scope:'synthetic'}).input;
  assert.equal(next.strata.find(s=>s.benchmark===r.benchmark&&s.configuration_id===r.config_id).operational.rows[0].correctness,null);
});
