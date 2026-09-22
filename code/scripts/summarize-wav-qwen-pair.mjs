// Sanitized report-only export. Never reads prompts, screenshots, HAR or gold.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error('Usage: node scripts/summarize-wav-qwen-pair.mjs BATCH_DIR NEW_REPORT.json');
const root=path.resolve(input),plan=JSON.parse(fs.readFileSync(path.join(root,'plan.json')));
if(plan.schema!=='pss-qwen38-paired-acceptance-v1'||plan.scope!=='diagnostic'||plan.confirmatory_authorized!==false)throw Error('Unexpected plan');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const rows=plan.jobs.map((job,index)=>{
 const folder=`${String(index).padStart(2,'0')}-${job.model||'shared'}-${job.task_id}-${job.framework}-${job.mode}`;
 const file=path.join(root,folder,'report.json');
 if(!fs.existsSync(file))return {...job,index,status:'no-sealed-report',official_score:null};
 const raw=fs.readFileSync(file),r=JSON.parse(raw);
 if(r.task_id!==job.task_id||r.framework!==job.framework||r.mode!==job.mode||
    (r.model?.model??null)!==job.model||r.confirmatory_authorized!==false)throw Error('Report identity mismatch');
 const receiptFile=path.join(root,folder,'trajectory','actor-receipt.json');
 const receipt=fs.existsSync(receiptFile)?JSON.parse(fs.readFileSync(receiptFile)):{};
 const intact=r.replay?.passed===true&&receipt.source_tree_unchanged===true;
 const chain=r.official_task_started===true&&r.official_task_completed===true&&r.assessment_status==='valid'&&
   !r.engineering_error&&r.owned_cleanup_completed===true&&!r.cleanup_error&&intact;
 return {...job,index,status:'sealed',report_sha256:sha(raw),
   official_task_started:r.official_task_started===true,official_task_completed:r.official_task_completed===true,
   official_score:r.official_score,assessment_status:r.assessment_status??null,
   actor_status:r.actor_status??null,failure_class:r.failure_class??null,engineering_error:r.engineering_error??null,
   replay_integrity_passed:r.replay?.passed===true,source_tree_unchanged:receipt.source_tree_unchanged===true,
   actor_budget_met:receipt.budget_met??null,actor_elapsed_ms:receipt.elapsed_ms??null,
   reset_elapsed_ms:r.reset_elapsed_ms??null,evaluation_elapsed_ms:r.postclose_native_evaluation_ms??null,
   cleanup_completed:r.owned_cleanup_completed===true,provider_requests:r.provider_requests??null,
   actions:r.actions??null,chain_valid:chain,
   completed_actor_success:chain&&r.actor_status==='completed'&&!r.failure_class&&receipt.budget_met===true&&r.official_score===1};
});
const summaryFile=path.join(root,'summary.json');
const state=fs.existsSync(summaryFile)?JSON.parse(fs.readFileSync(summaryFile)):null;
const groups=[];
for(const model of ['qwen3.8-max','qwen3.8-flash',null]) {
 for(const profile of model?['agentlab-browsergym/visual','agentlab-browsergym/hybrid','browser-use-restricted/hybrid']:['playwright/traditional']) {
  const selected=rows.filter(r=>r.model===model&&`${r.framework}/${r.mode}`===profile);
  groups.push({model,profile,planned:selected.length,sealed:selected.filter(r=>r.status==='sealed').length,
    official_actor_starts:selected.filter(r=>r.official_task_started).length,
    valid_native_scores:selected.filter(r=>r.assessment_status==='valid').length,
    completed_actor_successes:selected.filter(r=>r.completed_actor_success).length});
 }
}
const result={schema:'pss-qwen38-pair-sanitized-v1',scope:'diagnostic',confirmatory_authorized:false,
 generated_at:new Date().toISOString(),batch_name:path.basename(root),plan_sha256:sha(fs.readFileSync(path.join(root,'plan.json'))),
 source_sha256:plan.source_sha256,status:state?.status??'in-progress-or-interrupted-not-complete',stop_reason:state?.stop_reason??null,
 planned_executions:plan.planned_executions,distinct_planned_tasks:2,
 official_actor_starts:rows.filter(r=>r.official_task_started).length,
 shared_playwright_counted_once:true,pooled_capability_claim:false,groups,rows};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({output,status:result.status,official_actor_starts:result.official_actor_starts,groups}));
