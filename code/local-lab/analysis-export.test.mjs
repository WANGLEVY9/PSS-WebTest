import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAnalysisReport} from './analysis-export.mjs';
import {discoveryCohorts} from './study-analysis.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const fixture=()=>({schema:'pss-analysis-input-v1',data_kind:'SYNTHETIC_TEST',schedule_sha256:'a'.repeat(64),source_sha256:['b'.repeat(64)],strata:['c','d'].map(configuration_id=>({benchmark:'vwa',configuration_id,operational:{task_ids:['t'],rounds:[1,2],rows:[]},native_rows:[]})),pairs:[{benchmark:'vwa',c:'c',d:'d'}]});
test('analysis CLI persists source digest and refuses to overwrite existing evidence',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pss-analysis-fixture-'));
  try {
    const input=path.join(dir,'input.json'),output=path.join(dir,'output.json');fs.writeFileSync(input,JSON.stringify(fixture()));
    const args=[fileURLToPath(new URL('./analyze-study.mjs',import.meta.url)),input,output];
    assert.equal(spawnSync(process.execPath,args,{encoding:'utf8'}).status,0);
    const text=fs.readFileSync(output,'utf8'),r=JSON.parse(text);assert.match(r.input_sha256,/^[a-f0-9]{64}$/);assert.equal(r.data_kind,'SYNTHETIC_TEST');
    assert.notEqual(spawnSync(process.execPath,args,{encoding:'utf8'}).status,0);assert.equal(fs.readFileSync(output,'utf8'),text);
  } finally {fs.rmSync(dir,{recursive:true});}
});
test('analysis export preserves missing strata opportunities and never authorizes execution',()=>{
  const r=buildAnalysisReport(fixture());assert.equal(r.confirmatory_authorized,false);assert.equal(r.strata[0].operational.scheduled,2);assert.equal(r.strata[0].operational.lower,0);assert.equal(r.strata[0].operational.upper,1);assert.equal(r.strata[0].native.score,null);assert.equal(r.pairs[0].operational_difference_lower,-1);
});
test('analysis rejects duplicate strata, schedule mismatch and outcomes outside the frozen selection',()=>{
  let f=fixture();f.strata.push(f.strata[0]);assert.throws(()=>buildAnalysisReport(f),/Duplicate/);
  f=fixture();f.strata[1].operational.rounds=[2];assert.throws(()=>buildAnalysisReport(f),/identical/);
  f=fixture();f.strata[0].native_rows=[{task_id:'other',round:1,success:1}];assert.throws(()=>buildAnalysisReport(f),/outside/);
});
test('discovery errors need at least one error, controls require both complete discovery rounds',()=>{
  const r=discoveryCohorts({task_ids:['a','b','c','d'],discovery_rounds:['D1','D2'],error_type:'false_pass',rows:[{task_id:'a',round:'D1',expected:'FAIL',verdict:'PASS'},{task_id:'b',round:'D1',expected:'FAIL',verdict:'FAIL'},{task_id:'b',round:'D2',expected:'FAIL',verdict:'FAIL'},{task_id:'c',round:'D1',expected:'FAIL',verdict:'FAIL'},{task_id:'d',round:'D1',expected:'PASS',verdict:'FAIL'}]});
  assert.deepEqual(r.error_tasks,['a']);assert.deepEqual(r.control_tasks,['b']);assert.deepEqual(r.unclassified_tasks,['c']);
});
test('end-to-end ATA report derives both RQ3 and RQ4 from the same native records',()=>{
  const rounds=['D1','D2',...Array.from({length:10},(_,i)=>`V${i+1}`)],tasks=['error-case','control'];
  const f={...fixture(),strata:['c','d'].map(configuration_id=>({benchmark:'ata',configuration_id,
    operational:{task_ids:tasks,rounds,rows:[]},
    native_rows:tasks.flatMap(task_id=>rounds.map(round=>{
      const error=task_id==='error-case' && (configuration_id==='c'?round==='D1':round.startsWith('V'));
      return {task_id,round,started:true,expected:'FAIL',verdict:error?'PASS':'FAIL',...(!error?{step_class:'AFC'}:{})};
    }))})),pairs:[{benchmark:'ata',c:'c',d:'d',retry:{first_window:rounds.slice(2,7),second_window:rounds.slice(7)},error_conditioned:{discovery_rounds:['D1','D2'],validation_rounds:rounds.slice(2),error_type:'false_pass'}}]};
  const p=buildAnalysisReport(f).pairs[0];
  assert.equal(p.retry.metrics.n,2);assert.equal(p.error_conditioned.errors.contrast,-1);assert.equal(p.error_conditioned.controls.contrast,0);assert.equal(p.error_conditioned.excess,-1);
  assert.equal(p.retry.by_reference_class.FAIL.n,2);assert.equal(p.retry.by_reference_class.PASS.n,0);
  assert.deepEqual(p.error_conditioned.cohort.error_tasks,['error-case']);
  f.pairs[0].error_conditioned.validation_rounds.push('D1');assert.throws(()=>buildAnalysisReport(f),/disjoint/);
});
test('RQ4 rejects discovery leakage, swapped windows and lowered inclusion threshold',()=>{
 const rounds=['D1','D2',...Array.from({length:10},(_,i)=>`V${i+1}`)];
 const make=()=>({...fixture(),strata:['c','d'].map(configuration_id=>({benchmark:'vwa',configuration_id,operational:{task_ids:['t'],rounds,rows:[]},native_rows:[]})),pairs:[{benchmark:'vwa',c:'c',d:'d',retry:{first_window:rounds.slice(2,7),second_window:rounds.slice(7),min_joint:8}}]});
 assert.doesNotThrow(()=>buildAnalysisReport(make()));
 let f=make();f.pairs[0].retry.first_window[0]='D1';assert.throws(()=>buildAnalysisReport(f),/frozen validation/);
 f=make();f.pairs[0].retry.min_joint=7;assert.throws(()=>buildAnalysisReport(f),/min_joint/);
 f=make();[f.pairs[0].retry.first_window,f.pairs[0].retry.second_window]=[f.pairs[0].retry.second_window,f.pairs[0].retry.first_window];assert.throws(()=>buildAnalysisReport(f),/frozen validation/);
});
