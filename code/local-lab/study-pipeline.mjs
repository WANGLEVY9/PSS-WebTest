import {configurations,digest,validateDesign} from './study-design.mjs';
import {buildAnalysisReport} from './analysis-export.mjs';
const must=(v,msg)=>{if(!v)throw Error(msg);};
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const key=(task,config,round)=>JSON.stringify([task,config,round]);
export function validateTasks(design,tasks,{scope='formal'}={}) {
  must(['formal','diagnostic','synthetic'].includes(scope),'Explicit schedule scope required');
  must(Array.isArray(tasks)&&tasks.length>0,'Task manifest required');
  const seen=new Set();
  for(const t of tasks) {
    must(typeof t.task_key==='string'&&t.task_key && !seen.has(t.task_key),'Unique task keys required');seen.add(t.task_key);
    must(design.benchmarks.some(b=>b.id===t.benchmark)&&typeof t.official_task_id==='string'&&t.official_task_id&&hash(t.source_sha256),'Official task identity and source digest required');
    must(typeof t.application==='string'&&t.application,'Application namespace required');
    if(t.benchmark==='wav') must(t.template_id!==undefined&&t.template_id!==null,'WAV template identity required');
    if(t.benchmark==='ata') must(['PASS','FAIL'].includes(t.expected),'ATA reference class required');
  }
  const nativeKeys=tasks.map(t=>JSON.stringify([t.benchmark,t.source_sha256,t.application,t.official_task_id]));
  must(new Set(nativeKeys).size===tasks.length,'Duplicate source task identity');
  if(scope==='formal') {
    for(const b of design.benchmarks) must(tasks.filter(t=>t.benchmark===b.id).length===b.selected_tasks,'Formal manifest differs from selected denominator');
    const ata=design.benchmarks.find(b=>b.id==='ata');
    for(const [expected,count] of [['PASS',ata.expected_pass],['FAIL',ata.expected_fail]]) must(tasks.filter(t=>t.benchmark==='ata'&&t.expected===expected).length===count,'ATA class denominator differs from published benchmark');
  }
}
export function schedulePlan(design,tasks,{scope='formal',seed='pss-manuscript-v2',bindings=null}={}) {
  must(validateDesign(design).length===0,'Invalid active design');validateTasks(design,tasks,{scope});
  const selected=[...tasks].sort((a,b)=>a.task_key.localeCompare(b.task_key)),selection_sha256=digest(selected),cs=configurations(design);
  const rounds=[...design.rounds.discovery,...design.rounds.validation];
  const design_sha256=digest(design),bindings_sha256=bindings?digest(bindings):null,schedule_sha256=digest({design_sha256,selection_sha256,bindings_sha256,scope,seed});
  function* opportunities() {
    // All D rounds precede V rounds; each task/round interleaves all 19 configurations.
    for(const round of rounds) for(const task of selected) {
      const ordered=cs.map(c=>({c,rank:digest([seed,task.task_key,round,c.id])})).sort((a,b)=>a.rank.localeCompare(b.rank)).map(x=>x.c);
      for(const c of ordered) yield {protocol_id:design.protocol_id,opportunity_id:digest([schedule_sha256,task.task_key,c.id,round]),
        task_key:task.task_key,benchmark:task.benchmark,config_id:c.id,round,phase:round.startsWith('D')?'discovery':'validation',
        matched_block_id:digest([schedule_sha256,task.task_key,round]),scope,schedule_sha256};
    }
  }
  return {protocol_id:design.protocol_id,design_sha256,selection_sha256,bindings_sha256,schedule_sha256,scope,seed,
    tasks:selected.length,configurations:cs.length,rounds:rounds.length,scheduled:selected.length*cs.length*rounds.length,
    opportunities};
}
export function bindingReadiness(design,bindings) {
  const errors=[];
  if(bindings?.protocol_id!==design.protocol_id) errors.push('runtime protocol binding missing/mismatched');
  const matched=new Map(),modelBindings=new Map();
  for(const c of configurations(design)) {
    const b=bindings?.configurations?.[c.id];
    if(!b) {errors.push(`${c.id}: runtime binding not imported`);continue;}
    const common=['configuration_sha256','action_schema_sha256','boundary_audit_sha256'];
    for(const f of (c.model_id?common.concat(['prompt_sha256','image_settings_sha256','model_settings_sha256']):['configuration_sha256','script_manifest_sha256','blind_authoring_evidence_sha256'])) if(!hash(b[f])) errors.push(`${c.id}: missing ${f}`);
    if(!b.framework_revision || b.framework!==c.framework) errors.push(`${c.id}: framework identity missing/mismatched`);
    if(c.model_id&&(!b.model_api_id||!b.provider)) errors.push(`${c.id}: authorized model API binding missing`);
    if(c.model_id&&b.model_api_id&&b.provider) {
      const modelIdentity=JSON.stringify([b.provider,b.model_api_id]);
      if(modelBindings.has(c.model_id)&&modelBindings.get(c.model_id)!==modelIdentity) errors.push(`${c.id}: paired framework/input configurations must use the same model/provider`);
      modelBindings.set(c.model_id,modelIdentity);
    }
    for(const benchmark of design.benchmarks) {
      const p=bindings?.budget_profiles?.[b.budget_profile_by_benchmark?.[benchmark.id]];
      if(!p || !Number.isInteger(p.task_timeout_ms)||p.task_timeout_ms<1||!Number.isInteger(p.max_actions)||p.max_actions<1||!p.browser_revision||!p.locale||!p.timezone||!Number.isInteger(p.viewport?.width)||p.viewport.width<1||!Number.isInteger(p.viewport?.height)||p.viewport.height<1) {errors.push(`${c.id}/${benchmark.id}: matched numeric runtime profile missing`);continue;}
      const fingerprint=digest(design.budget_policy.matched_fields.map(f=>p[f]));
      if(matched.has(benchmark.id)&&matched.get(benchmark.id)!==fingerprint) errors.push(`${c.id}/${benchmark.id}: matched budget/browser settings differ`);
      matched.set(benchmark.id,fingerprint);
    }
  }
  return {ready:errors.length===0,errors};
}
export function validateRecords(design,tasks,records) {
  const byTask=new Map(tasks.map(t=>[t.task_key,t])),configs=new Set(configurations(design).map(c=>c.id)),rounds=new Set([...design.rounds.discovery,...design.rounds.validation]);
  const seen=new Set(),configurationDigests=new Map();
  for(const r of records) {
    must(r.protocol_id===design.protocol_id,'Historical acquisition protocol requires explicit reconciliation; never silently relabel records');
    const k=key(r.task_key,r.config_id,r.round),t=byTask.get(r.task_key);
    must(t&&configs.has(r.config_id)&&rounds.has(r.round)&&!seen.has(k),'Record outside selected matrix or duplicate opportunity');seen.add(k);
    must(typeof r.source_opportunity_id==='string'&&r.source_opportunity_id&&hash(r.source_sha256)&&hash(r.configuration_sha256),'Original opportunity/configuration provenance required');
    const configKey=JSON.stringify([t.benchmark,r.config_id]);
    if(configurationDigests.has(configKey)) must(configurationDigests.get(configKey)===r.configuration_sha256,'Configuration changed within imported stratum; separate protocol versions');
    configurationDigests.set(configKey,r.configuration_sha256);
    must(['MEASURED','SYNTHETIC_TEST'].includes(r.data_kind),'Explicit record evidence kind required');
    must(r.phase===(r.round.startsWith('D')?'discovery':'validation'),'Recorded D/V allocation mismatch; do not relabel history');
    must(['prepared','unprepared','unknown'].includes(r.preparation_status)&&typeof r.started==='boolean','Preparation and started state required');
    must(['valid','unresolved'].includes(r.assessment_status)&&[true,false,null].includes(r.budget_met),'Explicit assessment/budget state required');
    must(['completed','failed','no-verdict','timeout','provider-error','reset-error','evaluator-error','not-started'].includes(r.terminal_status),'Terminal status required');
    if(['reset-error','evaluator-error'].includes(r.terminal_status)) must(r.assessment_status==='unresolved','Reset/evaluator failure must remain unresolved');
    if(r.terminal_status==='not-started') must(!r.started,'Not-started status cannot claim an execution');
    must(r.preparation_status!=='unprepared'||!r.started,'Unprepared opportunity cannot start');
    must(r.native_score===null||r.native_score===0||r.native_score===1,'Native score must be binary or unresolved');
    must(r.verdict===null||['PASS','FAIL'].includes(r.verdict),'Invalid verdict');
    if(r.assessment_status==='unresolved') must(r.native_score===null&&r.verdict===null,'Unresolved assessment cannot supply an assessed native score/verdict');
    if(!r.started) must(r.native_score===null&&r.verdict===null,'Unstarted opportunity cannot have native outcome');
    if(t.benchmark==='ata'&&r.verdict==='FAIL'&&t.expected==='FAIL') must(['AFB','AFC','AFA','Ustep'].includes(r.step_class),'TP requires audited step alignment or Ustep');
    if(t.benchmark==='ata') must(r.native_score===null,'ATA native endpoint is verdict, not a substituted task score');
    else must(r.verdict===null,'WAV/VWA do not use ATA verdict endpoints');
  }
}
export function reconcile(design,tasks,records,options={}) {
  const plan=schedulePlan(design,tasks,options);validateRecords(design,tasks,records);
  const observed=new Map(records.map(r=>[key(r.task_key,r.config_id,r.round),r]));
  const coverage=configurations(design).map(c=>({config_id:c.id,scheduled:tasks.length*12,imported:0,started:0,unprepared:0,explicit_not_started:0,not_imported_unknown:0})),byConfig=new Map(coverage.map(c=>[c.config_id,c]));
  for(const op of plan.opportunities()) {
    const c=byConfig.get(op.config_id),r=observed.get(key(op.task_key,op.config_id,op.round));
    if(!r) {c.not_imported_unknown++;continue;}
    c.imported++;if(r.started)c.started++;if(r.preparation_status==='unprepared')c.unprepared++;
    if(r.terminal_status==='not-started'&&r.preparation_status==='prepared')c.explicit_not_started++;
  }
  return {...Object.fromEntries(Object.entries(plan).filter(([k])=>k!=='opportunities')),coverage,
    imported:records.length,not_imported_unknown:plan.scheduled-records.length,
    global_completed_count:null,global_status:'unknown-from-local-import; preserve user-reported-existing-collection',
    automatically_enqueued:0,new_execution_authorized:false};
}
export function recordsToAnalysis(design,tasks,records,options={}) {
  const plan=schedulePlan(design,tasks,options);validateRecords(design,tasks,records);
  must(records.length>0,'At least one source record is required for analysis');
  const kinds=new Set(records.map(r=>r.data_kind));must(kinds.size===1,'Synthetic and measured records cannot be pooled');
  if(options.scope==='synthetic') must(kinds.has('SYNTHETIC_TEST'),'Synthetic scope requires synthetic records');
  else must(kinds.has('MEASURED'),'Measured scope cannot contain synthetic records');
  const rounds=[...design.rounds.discovery,...design.rounds.validation],strata=[];
  const byCell=new Map(records.map(r=>[key(r.task_key,r.config_id,r.round),r]));
  for(const b of design.benchmarks) {
    const selected=tasks.filter(t=>t.benchmark===b.id);if(!selected.length)continue;
    for(const c of configurations(design)) {
      const operational=[],native_rows=[],unprepared_task_ids=[];
      for(const t of selected) {
        const rs=rounds.map(round=>byCell.get(key(t.task_key,c.id,round)));
        const unprepared=rs.every(r=>r?.preparation_status==='unprepared');if(unprepared)unprepared_task_ids.push(t.task_key);
        for(let i=0;i<rounds.length;i++) {
          const r=rs[i];if(!r)continue;
          let correctness=null;
          if(r.preparation_status==='unprepared') correctness=0;
          else if(r.assessment_status==='valid'&&r.started) {
            const correct=b.id==='ata'?(r.verdict===null?0:Number(r.verdict===t.expected)):r.native_score;
            // Unresolved budget does not turn observed task failure into an unknown failure.
            correctness=['failed','timeout','provider-error','no-verdict'].includes(r.terminal_status)?0:correct===0?0:r.budget_met===false?0:r.budget_met===true?correct:null;
          }
          if(!unprepared) operational.push({task_id:t.task_key,round:rounds[i],correctness});
          native_rows.push(b.id==='ata'?{task_id:t.task_key,round:rounds[i],started:r.started,expected:t.expected,verdict:r.verdict,...(r.step_class?{step_class:r.step_class}:{})}:{task_id:t.task_key,round:rounds[i],success:r.native_score,...(b.id==='wav'?{template_id:t.template_id}:{})});
        }
      }
      strata.push({benchmark:b.id,configuration_id:c.id,operational:{task_ids:selected.map(t=>t.task_key),rounds,rows:operational,unprepared_task_ids},native_rows});
    }
  }
  const pairs=[];
  for(const b of design.benchmarks.filter(b=>tasks.some(t=>t.benchmark===b.id))) for(let m=1;m<=6;m++) for(const d of [`h${m}`,'s']) {
    const base={benchmark:b.id,c:`v${m}`,d,retry:{first_window:design.rounds.retry_windows[0],second_window:design.rounds.retry_windows[1],min_joint:design.rounds.retry_min_joint}};
    if(b.id==='ata') for(const error_type of ['false_pass','false_alarm']) pairs.push({...base,error_conditioned:{discovery_rounds:design.rounds.discovery,validation_rounds:design.rounds.validation,error_type}});
    else pairs.push(base);
  }
  const input={schema:'pss-analysis-input-v1',data_kind:kinds.has('SYNTHETIC_TEST')?'SYNTHETIC_TEST':options.scope==='formal'?'CONFIRMATORY_CANDIDATE':'DIAGNOSTIC',schedule_sha256:plan.schedule_sha256,source_sha256:[...new Set(records.map(r=>r.source_sha256))],strata,pairs};
  return {input,report:{...buildAnalysisReport(input),protocol_id:design.protocol_id,design_sha256:plan.design_sha256,selection_sha256:plan.selection_sha256}};
}
