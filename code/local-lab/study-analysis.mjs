// Candidate manuscript-aligned analysis. Pure functions; never authorizes a run or changes a freeze.
export const ANALYSIS_VERSION = 'candidate-rq-analysis-v1';
const mean = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
const bit = x => x === 0 || x === 1;
function requireValue(ok, message) { if (!ok) throw Error(message); }
function uniqueRows(rows, fields) {
  const seen = new Set();
  for (const r of rows) {
    requireValue(fields.every(k=>r[k] !== undefined && r[k] !== null && r[k] !== ''), 'Missing analysis identity');
    const key=JSON.stringify(fields.map(k=>r[k]));
    requireValue(!seen.has(key), 'Duplicate analysis identity'); seen.add(key);
  }
}
function groups(rows, field) {
  const m=new Map(); for(const r of rows) {const a=m.get(r[field])||[];a.push(r);m.set(r[field],a);} return m;
}

// Input must be ONE benchmark/configuration stratum, with explicit scorable 0/1/null outcomes.
// Round labels come from the frozen schedule, not just the observed records.
export function nativeRoundRates(rows, {benchmark, rounds}) {
  requireValue(['wav','vwa'].includes(benchmark), 'Unsupported native metric');
  requireValue(Array.isArray(rounds) && rounds.length>0 && new Set(rounds).size===rounds.length, 'Unique planned rounds required');
  uniqueRows(rows,['task_id','round']);
  const byRound=groups(rows,'round');
  const templates=new Map();
  for(const r of rows) {
    requireValue(rounds.includes(r.round) && (bit(r.success)||r.success===null),'Invalid round or native outcome');
    if(benchmark==='wav') {
      requireValue(r.template_id!==undefined && r.template_id!==null,'Template identity required');
      if(templates.has(r.task_id)) requireValue(templates.get(r.task_id)===r.template_id,'Task template changed across rounds');
      templates.set(r.task_id,r.template_id);
    }
  }
  const per_round=rounds.map(round=>{
    const all=byRound.get(round)||[], scored=all.filter(r=>bit(r.success));
    const templateScores=[...groups(scored,'template_id').values()].map(rs=>mean(rs.map(r=>r.success)));
    return {round,score:benchmark==='wav'?mean(templateScores):mean(scored.map(r=>r.success)),
      supplied:all.length,scorable:scored.length,represented_templates:benchmark==='wav'?templateScores.length:null};
  });
  // An entirely unscorable round is not silently removed from the declared round mean.
  return {analysis_version:ANALYSIS_VERSION,per_round,score:per_round.every(r=>r.score!==null)?mean(per_round.map(r=>r.score)):null,
    represented_rounds:per_round.filter(r=>r.score!==null).length,planned_rounds:rounds.length};
}

export function ataNativeMetrics(rows) {
  uniqueRows(rows,['task_id','round']);
  const counts={TP:0,TN:0,FP:0,FN:0,AFB:0,AFC:0,AFA:0,Ustep:0}; let started=0;
  for(const r of rows) {
    requireValue(['PASS','FAIL'].includes(r.expected) && typeof r.started==='boolean','Explicit gold class and started flag required');
    requireValue(r.verdict===null || ['PASS','FAIL'].includes(r.verdict),'Invalid verdict');
    if(r.started) started++;
    if(r.verdict===null) continue;
    requireValue(r.started,'Unstarted attempt cannot have a verdict');
    if(r.expected==='FAIL' && r.verdict==='FAIL') {
      counts.TP++;
      requireValue(['AFB','AFC','AFA','Ustep'].includes(r.step_class),'Verified TP step classification required (or Ustep)');
      counts[r.step_class]++;
    } else if(r.expected==='PASS' && r.verdict==='PASS') counts.TN++;
    else if(r.expected==='PASS') counts.FP++; else counts.FN++;
  }
  const {TP,TN,FP,FN,AFB,AFC,AFA,Ustep}=counts, n=TP+TN+FP+FN;
  const ratio=(a,b)=>b?a/b:null;
  return {...counts,scheduled:rows.length,started,binary_count:n,binary_coverage:ratio(n,started),
    accuracy:ratio(TP+TN,n),sensitivity:ratio(TP,TP+FN),specificity:ratio(TN,TN+FP),
    step_mismatch_rate:ratio(AFB+AFA,TP),exact_step_fraction:ratio(AFC,TP),unresolved_step_fraction:ratio(Ustep,TP),
    true_accuracy_lower:ratio(AFC+TN,n),true_accuracy_upper:ratio(AFC+TN+Ustep,n)};
}

// All selected tasks are supplied separately: absent executions stay unresolved, never disappear.
export function operationalTaskSummary({task_ids,rounds,rows,unprepared_task_ids=[]}) {
  requireValue(task_ids.length>0 && rounds.length>0 && new Set(task_ids).size===task_ids.length && new Set(rounds).size===rounds.length,'Unique selected tasks and rounds required');
  requireValue(new Set(unprepared_task_ids).size===unprepared_task_ids.length && unprepared_task_ids.every(t=>task_ids.includes(t)),'Invalid unprepared task set');
  uniqueRows(rows,['task_id','round']);
  for(const r of rows) requireValue(task_ids.includes(r.task_id) && rounds.includes(r.round) && (bit(r.correctness)||r.correctness===null) && !unprepared_task_ids.includes(r.task_id),'Invalid operational opportunity');
  const lookup=new Map(rows.map(r=>[JSON.stringify([r.task_id,r.round]),r.correctness]));
  const tasks=task_ids.map(task_id=>{
    const unprepared=unprepared_task_ids.includes(task_id);
    const values=rounds.map(round=>unprepared?0:lookup.get(JSON.stringify([task_id,round]))??null);
    const unresolved=values.filter(v=>v===null).length;
    const category=unprepared?'unprepared':unresolved?'unresolved':values.every(v=>v===1)?'always_correct':values.every(v=>v===0)?'always_incorrect':'mixed';
    return {task_id,category,unresolved,lower:mean(values.map(v=>v??0)),upper:mean(values.map(v=>v??1))};
  });
  const count=c=>tasks.filter(t=>t.category===c).length;
  return {tasks,selected_tasks:tasks.length,scheduled:tasks.length*rounds.length,observed:rows.length,
    unprepared_opportunities:unprepared_task_ids.length*rounds.length,
    lower:mean(tasks.map(t=>t.lower)),upper:mean(tasks.map(t=>t.upper)),
    always_correct_coverage:count('always_correct')/tasks.length,
    at_least_once_lower:(count('always_correct')+count('mixed'))/tasks.length,
    at_least_once_upper:(count('always_correct')+count('mixed')+count('unresolved'))/tasks.length};
}

// Caller constructs the predeclared discovery cohort using D rounds ONLY.
// Validation: equal-case, jointly binary same-round comparisons. Missing entire cases get [-1,1].
export function retainedCaseContrast({cohort_task_ids,validation_rounds,rows}) {
  requireValue(new Set(cohort_task_ids).size===cohort_task_ids.length && new Set(validation_rounds).size===validation_rounds.length && validation_rounds.length>0,'Unique cohort and validation rounds required');
  uniqueRows(rows,['task_id','round']);
  for(const r of rows) requireValue(cohort_task_ids.includes(r.task_id) && validation_rounds.includes(r.round) && [r.c,r.d].every(v=>bit(v)||v===null),'Invalid validation pair');
  const byTask=groups(rows,'task_id');
  const cases=cohort_task_ids.map(task_id=>{
    const joint=(byTask.get(task_id)||[]).filter(r=>bit(r.c)&&bit(r.d));
    return {task_id,joint_rounds:joint.length,contrast:mean(joint.map(r=>r.d-r.c))};
  });
  const retained=cases.filter(r=>r.contrast!==null), contrast=mean(retained.map(r=>r.contrast));
  const n=cohort_task_ids.length,rho=n?retained.length/n:null;
  return {cases,cohort_size:n,retained_cases:retained.length,contrast,
    omitted_case_lower:n?rho*(contrast??0)-(1-rho):null,
    omitted_case_upper:n?rho*(contrast??0)+(1-rho):null,
    bounds_scope:'whole omitted cases only; not missing rounds or confidence intervals'};
}

// RQ3: selection looks ONLY at the anchor configuration's discovery outcomes.
// Positive error is false PASS for gold FAIL, or false alarm for gold PASS.
export function discoveryCohorts({task_ids,discovery_rounds,rows,error_type}) {
  requireValue(['false_pass','false_alarm'].includes(error_type),'Explicit error type required');
  requireValue(task_ids.length>0 && new Set(task_ids).size===task_ids.length && discovery_rounds.length===2 && new Set(discovery_rounds).size===2,'Unique selected tasks and two discovery rounds required');
  uniqueRows(rows,['task_id','round']);
  for(const r of rows) requireValue(task_ids.includes(r.task_id) && discovery_rounds.includes(r.round) && ['PASS','FAIL'].includes(r.expected) && (r.verdict===null || ['PASS','FAIL'].includes(r.verdict)),'Invalid discovery observation');
  const gold=error_type==='false_pass'?'FAIL':'PASS',bad=gold==='FAIL'?'PASS':'FAIL';
  const error_tasks=[],control_tasks=[],unclassified_tasks=[];
  const byTask=groups(rows,'task_id');
  for(const task_id of task_ids) {
    const rs=byTask.get(task_id)||[];
    requireValue(new Set(rs.map(r=>r.expected)).size<=1,'Gold class changed across rounds');
    if(!rs.length) {unclassified_tasks.push(task_id);continue;}
    if(rs[0].expected!==gold) continue;
    if(rs.some(r=>r.verdict===bad)) error_tasks.push(task_id);
    else if(rs.length===2 && rs.every(r=>r.verdict===gold)) control_tasks.push(task_id);
    else unclassified_tasks.push(task_id);
  }
  return {error_type,expected:gold,error_tasks,control_tasks,unclassified_tasks};
}

export function validationRetryBlocks(rows,{first_window,second_window,min_joint=8}) {
  const rounds=[...first_window,...second_window];
  requireValue(first_window.length>0 && second_window.length>0 && new Set(rounds).size===rounds.length && Number.isInteger(min_joint) && min_joint>0,'Disjoint ordered windows and positive joint threshold required');
  uniqueRows(rows,['task_id','round']);
  for(const r of rows) requireValue(rounds.includes(r.round) && [r.c,r.d].every(v=>bit(v)||v===null),'Invalid retry observation');
  const blocks=[],excluded=[];
  for(const [task_id,rs] of groups(rows,'task_id')) {
    const joint=rs.filter(r=>bit(r.c)&&bit(r.d)).length;
    const first=(arm,window)=>window.map(round=>rs.find(r=>r.round===round)).find(r=>r && bit(r[arm]));
    const c1=first('c',first_window),c2=first('c',second_window),d1=first('d',first_window),d2=first('d',second_window);
    if(joint<min_joint || !c1 || !c2 || !d1 || !d2) {excluded.push({task_id,joint_rounds:joint});continue;}
    const templates=new Set(rs.map(r=>r.template_id));requireValue(templates.size===1,'Task template changed across rounds');
    blocks.push({task_id,template_id:rs[0].template_id,c1:c1.c,c2:c2.c,d1:d1.d,d2:d2.d,
      selected_rounds:{c1:c1.round,c2:c2.round,d1:d1.round,d2:d2.round},joint_rounds:joint});
  }
  return {blocks,excluded};
}

export function weightedRetryComplementarity(blocks,{benchmark}) {
  requireValue(['wav','vwa','ata'].includes(benchmark),'Benchmark weighting required');
  uniqueRows(blocks,['task_id']);
  for(const b of blocks) requireValue(['c1','c2','d1','d2'].every(k=>bit(b[k])) && (benchmark!=='wav'||b.template_id!==undefined && b.template_id!==null),'Complete, identified blocks required');
  const strata=benchmark==='wav'?[...groups(blocks,'template_id').values()]:[blocks];
  const weighted=fn=>blocks.length?mean(strata.map(rs=>mean(rs.map(fn)))):null;
  const mixed=weighted(b=>(Math.max(b.c1,b.d2)+Math.max(b.c2,b.d1))/2), cc=weighted(b=>Math.max(b.c1,b.c2)), dd=weighted(b=>Math.max(b.d1,b.d2));
  const pc=weighted(b=>(b.c1+b.c2)/2),pd=weighted(b=>(b.d1+b.d2)/2);
  const Dcd=weighted(b=>(Math.abs(b.c1-b.d2)+Math.abs(b.c2-b.d1))/2),Dcc=weighted(b=>Math.abs(b.c1-b.c2)),Ddd=weighted(b=>Math.abs(b.d1-b.d2));
  return {n:blocks.length,represented_templates:benchmark==='wav'?strata.length:null,mixed,cc,dd,pc,pd,Dcd,Dcc,Ddd,
    margin:blocks.length?mixed-Math.max(cc,dd):null,
    mixed_minus_cc:blocks.length?((pd-pc)+(Dcd-Dcc))/2:null,
    mixed_minus_dd:blocks.length?((pc-pd)+(Dcd-Ddd))/2:null};
}
