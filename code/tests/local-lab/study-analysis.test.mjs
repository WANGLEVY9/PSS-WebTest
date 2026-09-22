// SYNTHETIC fixtures only; these tests are not empirical observations.
import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeRoundRates,ataNativeMetrics,operationalTaskSummary,retainedCaseContrast,validationRetryBlocks,weightedRetryComplementarity} from '../../local-lab/study-analysis.mjs';
test('native scoring averages rounds, with WAV macro within each round',()=>{
  const rows=[{task_id:'a',template_id:'t',round:1,success:1},{task_id:'b',template_id:'t',round:1,success:1},{task_id:'c',template_id:'u',round:1,success:0},{task_id:'a',template_id:'t',round:2,success:0}];
  assert.equal(nativeRoundRates(rows,{benchmark:'wav',rounds:[1,2]}).score,.25);
  assert.equal(nativeRoundRates(rows,{benchmark:'vwa',rounds:[1,2]}).score,1/3);
  assert.equal(nativeRoundRates(rows,{benchmark:'wav',rounds:[1,2,3]}).score,null);
  assert.throws(()=>nativeRoundRates([...rows,rows[0]],{benchmark:'wav',rounds:[1,2]}),/Duplicate/);
});
test('ATA started denominator and unresolved TP steps are distinct from scheduled slots',()=>{
  const rows=[{expected:'FAIL',verdict:'FAIL',started:true,step_class:'AFC'},{expected:'FAIL',verdict:'FAIL',started:true,step_class:'Ustep'},{expected:'PASS',verdict:'PASS',started:true},{expected:'PASS',verdict:null,started:true},{expected:'PASS',verdict:null,started:false}].map((r,i)=>({...r,task_id:i,round:1}));
  const a=ataNativeMetrics(rows);assert.equal(a.binary_coverage,3/4);assert.equal(a.true_accuracy_lower,2/3);assert.equal(a.true_accuracy_upper,1);assert.equal(a.unresolved_step_fraction,.5);
  assert.throws(()=>ataNativeMetrics([{...rows[0],started:false}]),/Unstarted/);
  assert.throws(()=>ataNativeMetrics([{...rows[0],step_class:undefined}]),/classification/);
});
test('all frozen slots persist; unprepared zero, absent/null unresolved, partial success not always correct',()=>{
  const s=operationalTaskSummary({task_ids:['a','b','c','d'],rounds:[1,2],unprepared_task_ids:['b'],rows:[{task_id:'a',round:1,correctness:1},{task_id:'a',round:2,correctness:1},{task_id:'c',round:1,correctness:1},{task_id:'d',round:1,correctness:0},{task_id:'d',round:2,correctness:1}]});
  assert.equal(s.scheduled,8);assert.equal(s.lower,.5);assert.equal(s.upper,.625);assert.equal(s.always_correct_coverage,.25);assert.equal(s.at_least_once_lower,.5);assert.equal(s.at_least_once_upper,.75);
  assert.throws(()=>operationalTaskSummary({task_ids:['a'],rounds:[1],unprepared_task_ids:['a'],rows:[{task_id:'a',round:1,correctness:1}]}),/Invalid/);
});
test('paired contrasts weight cases, not available validation rounds, and bound omitted cases',()=>{
  const s=retainedCaseContrast({cohort_task_ids:['a','b','c'],validation_rounds:[1,2],rows:[{task_id:'a',round:1,c:0,d:1},{task_id:'a',round:2,c:0,d:1},{task_id:'b',round:1,c:1,d:0}]});
  assert.equal(s.contrast,0);assert.equal(s.retained_cases,2);assert.ok(Math.abs(s.omitted_case_lower+1/3)<1e-12);
  assert.deepEqual(retainedCaseContrast({cohort_task_ids:['a'],validation_rounds:[1],rows:[]}).omitted_case_upper,1);
});
test('retry block picks first available per config per window after joint-availability gate',()=>{
  const rows=Array.from({length:10},(_,i)=>({task_id:'a',template_id:'t',round:i+1,c:i===0?null:1,d:i===1?null:0}));
  const b=validationRetryBlocks(rows,{first_window:[1,2,3,4,5],second_window:[6,7,8,9,10]});
  assert.equal(b.blocks.length,1);assert.equal(b.blocks[0].selected_rounds.c1,2);assert.equal(b.blocks[0].selected_rounds.d1,1);
  assert.equal(validationRetryBlocks(rows.slice(0,9),{first_window:[1,2,3,4,5],second_window:[6,7,8,9,10]}).blocks.length,0);
});
test('retry template weighting and algebra identities hold on all 16 binary blocks',()=>{
  const blocks=Array.from({length:16},(_,i)=>({task_id:i,template_id:i===0?'small':'large',c1:i&1,c2:(i>>1)&1,d1:(i>>2)&1,d2:(i>>3)&1}));
  for(const benchmark of ['wav','vwa','ata']) {
    const a=weightedRetryComplementarity(blocks,{benchmark});
    assert.ok(Math.abs((a.mixed-a.cc)-a.mixed_minus_cc)<1e-12);
    assert.ok(Math.abs((a.mixed-a.dd)-a.mixed_minus_dd)<1e-12);
  }
  assert.notEqual(weightedRetryComplementarity(blocks,{benchmark:'wav'}).mixed,weightedRetryComplementarity(blocks,{benchmark:'vwa'}).mixed);
  assert.equal(weightedRetryComplementarity([],{benchmark:'ata'}).margin,null);
  assert.throws(()=>weightedRetryComplementarity([{...blocks[0],c1:null}],{benchmark:'ata'}),/Complete/);
});
