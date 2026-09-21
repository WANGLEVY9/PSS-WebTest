// Explicit stratum adapter: intentionally does not infer missing schedule, gold or stages from logs.
import {ANALYSIS_VERSION,nativeRoundRates,ataNativeMetrics,operationalTaskSummary,discoveryCohorts,retainedCaseContrast,validationRetryBlocks,weightedRetryComplementarity} from './study-analysis.mjs';
export function buildAnalysisReport(input) {
  if(input.schema!=='pss-analysis-input-v1' || !['DIAGNOSTIC','SYNTHETIC_TEST','CONFIRMATORY_CANDIDATE'].includes(input.data_kind)) throw Error('Explicit analysis schema and evidence kind required');
  if(!/^[a-f0-9]{64}$/.test(input.schedule_sha256||'') || !Array.isArray(input.source_sha256) || !input.source_sha256.length || input.source_sha256.some(x=>!/^[a-f0-9]{64}$/.test(x))) throw Error('Schedule and source digests required');
  if(!Array.isArray(input.strata) || !input.strata.length) throw Error('Explicit configuration strata required');
  const seen=new Set(),indexes=new Map();
  const strata=input.strata.map(s=>{
    if(!['wav','vwa','ata'].includes(s.benchmark) || typeof s.configuration_id!=='string' || !s.configuration_id || !s.operational) throw Error('Benchmark, configuration and operational manifest required');
    const key=JSON.stringify([s.benchmark,s.configuration_id]);if(seen.has(key)) throw Error('Duplicate configuration stratum');seen.add(key);
    const operational=operationalTaskSummary(s.operational);
    const native=s.native_rows;
    if(!Array.isArray(native)) throw Error('Explicit native rows required');
    for(const row of native) {
      if(!s.operational.task_ids.includes(row.task_id) || !s.operational.rounds.includes(row.round)) throw Error('Native row outside selected schedule');
      if(s.operational.unprepared_task_ids?.includes(row.task_id) && (s.benchmark==='ata'?row.started || row.verdict!==null:row.success!==null)) throw Error('Unprepared task cannot contribute a native result');
    }
    const index=new Map(),taskMeta=new Map();
    for(const r of native) {
      index.set(JSON.stringify([r.task_id,r.round]),r);
      const meta=s.benchmark==='ata'?r.expected:r.template_id;
      if(taskMeta.has(r.task_id) && taskMeta.get(r.task_id)!==meta) throw Error('Gold class or template changed across rounds');
      taskMeta.set(r.task_id,meta);
    }
    indexes.set(key,{index,taskMeta});
    return {benchmark:s.benchmark,configuration_id:s.configuration_id,operational,
      native:s.benchmark==='ata'?ataNativeMetrics(native):nativeRoundRates(native,{benchmark:s.benchmark,rounds:s.operational.rounds})};
  });
  const pairs=(input.pairs||[]).map(p=>{
    if(!seen.has(JSON.stringify([p.benchmark,p.c])) || !seen.has(JSON.stringify([p.benchmark,p.d])) || p.c===p.d) throw Error('Pair requires two represented configurations');
    const c=input.strata.find(s=>s.benchmark===p.benchmark && s.configuration_id===p.c),d=input.strata.find(s=>s.benchmark===p.benchmark && s.configuration_id===p.d);
    const ci=indexes.get(JSON.stringify([p.benchmark,p.c])),di=indexes.get(JSON.stringify([p.benchmark,p.d]));
    const get=(idx,task,round)=>idx.index.get(JSON.stringify([task,round]));
    for(const task of c.operational.task_ids) if(ci.taskMeta.has(task)&&di.taskMeta.has(task)&&ci.taskMeta.get(task)!==di.taskMeta.get(task)) throw Error('Paired gold class or template identity mismatch');
    if(JSON.stringify(c.operational.task_ids)!==JSON.stringify(d.operational.task_ids) || JSON.stringify(c.operational.rounds)!==JSON.stringify(d.operational.rounds)) throw Error('Paired configurations require identical ordered selection and schedule');
    const cs=strata.find(s=>s.benchmark===p.benchmark&&s.configuration_id===p.c).operational,ds=strata.find(s=>s.benchmark===p.benchmark&&s.configuration_id===p.d).operational;
    const out={benchmark:p.benchmark,c:p.c,d:p.d,operational_difference_lower:ds.lower-cs.upper,operational_difference_upper:ds.upper-cs.lower};
    if(p.retry) {
      if(p.retry.rows) throw Error('Retry outcomes must derive from native rows, not an independent outcome table');
      const windows=[...p.retry.first_window,...p.retry.second_window];
      if(windows.some(r=>!c.operational.rounds.includes(r))) throw Error('Retry analysis outside selected schedule');
      const value=r=>!r?null:p.benchmark==='ata'?(r.verdict===null?null:Number(r.verdict===r.expected)):r.success;
      const retryRows=c.operational.task_ids.flatMap(task_id=>windows.map(round=>{
        const a=get(ci,task_id,round),b=get(di,task_id,round);
        if(p.benchmark==='ata'&&a&&b&&a.expected!==b.expected) throw Error('Paired gold class mismatch');
        return {task_id,round,c:value(a),d:value(b),template_id:p.benchmark==='ata'?undefined:ci.taskMeta.get(task_id)??di.taskMeta.get(task_id)};
      }));
      const blocks=validationRetryBlocks(retryRows,p.retry);
      out.retry={selected_tasks:c.operational.task_ids.length,selection_policy:p.retry,...blocks,metrics:weightedRetryComplementarity(blocks.blocks,{benchmark:p.benchmark})};
      if(p.benchmark==='ata') out.retry.by_reference_class=Object.fromEntries(['PASS','FAIL'].map(expected=>[expected,weightedRetryComplementarity(blocks.blocks.filter(b=>(ci.taskMeta.get(b.task_id)??di.taskMeta.get(b.task_id))===expected),{benchmark:'ata'})]));
    }
    if(p.error_conditioned) {
      if(p.benchmark!=='ata') throw Error('Error-conditioned analysis requires ATA');
      const e=p.error_conditioned;
      if(e.discovery_rounds.some(r=>e.validation_rounds.includes(r)) || [...e.discovery_rounds,...e.validation_rounds].some(r=>!c.operational.rounds.includes(r))) throw Error('Discovery and validation must be disjoint scheduled stages');
      // Discovery reads the anchor's native records, not supplied model labels or validation outcomes.
      const cohort=discoveryCohorts({task_ids:c.operational.task_ids,discovery_rounds:e.discovery_rounds,error_type:e.error_type,rows:c.native_rows.filter(r=>e.discovery_rounds.includes(r.round))});
      const correct=r=>!r || r.verdict===null?null:Number(r.verdict===r.expected);
      const rows=c.operational.task_ids.flatMap(task_id=>e.validation_rounds.map(round=>{
        const a=get(ci,task_id,round),b=get(di,task_id,round);
        if(a&&b&&a.expected!==b.expected) throw Error('Paired gold class mismatch');
        return {task_id,round,c:correct(a),d:correct(b)};
      }));
      const contrast=ids=>retainedCaseContrast({cohort_task_ids:ids,validation_rounds:e.validation_rounds,rows:rows.filter(r=>ids.includes(r.task_id))});
      const errors=contrast(cohort.error_tasks),controls=contrast(cohort.control_tasks);
      out.error_conditioned={contrast_direction:'alternative-correctness-minus-visual-correctness',cohort,errors,controls,excess:errors.contrast===null||controls.contrast===null?null:errors.contrast-controls.contrast};
    }
    return out;
  });
  return {analysis_version:ANALYSIS_VERSION,data_kind:input.data_kind,schedule_sha256:input.schedule_sha256,source_sha256:input.source_sha256,
    confirmatory_authorized:false,authorization_note:'Analysis completeness is not benchmark admission or human screening approval',strata,pairs};
}
