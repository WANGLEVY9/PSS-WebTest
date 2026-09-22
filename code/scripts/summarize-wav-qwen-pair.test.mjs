import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('./summarize-wav-qwen-pair.mjs',import.meta.url));
test('partial evidence stays partial; shared script not duplicated and model drift rejected',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pss-pair-summary-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const jobs=[{task_id:260,framework:'playwright',mode:'traditional',model:null},
 {task_id:260,framework:'agentlab-browsergym',mode:'visual',model:'qwen3.8-flash'}];
 fs.writeFileSync(path.join(dir,'plan.json'),JSON.stringify({schema:'pss-qwen38-paired-acceptance-v1',scope:'diagnostic',confirmatory_authorized:false,planned_executions:14,jobs}));
 const folder=path.join(dir,'00-shared-260-playwright-traditional');fs.mkdirSync(path.join(folder,'trajectory'),{recursive:true});
 const report={...jobs[0],model:null,confirmatory_authorized:false,official_task_started:true,official_task_completed:true,assessment_status:'valid',owned_cleanup_completed:true,replay:{passed:true},actor_status:'completed',official_score:1};
 fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify(report));
 fs.writeFileSync(path.join(folder,'trajectory','actor-receipt.json'),JSON.stringify({source_tree_unchanged:true,budget_met:true}));
 const out=path.join(dir,'export.json');const r=spawnSync(process.execPath,[script,dir,out],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 const data=JSON.parse(fs.readFileSync(out));assert.equal(data.official_actor_starts,1);assert.equal(data.rows[1].status,'no-sealed-report');
 assert.equal(data.groups.filter(g=>g.model===null)[0].completed_actor_successes,1);assert.equal(data.confirmatory_authorized,false);
 report.model={model:'qwen3.8-flash'};fs.writeFileSync(path.join(folder,'report.json'),JSON.stringify(report));
 const bad=spawnSync(process.execPath,[script,dir,path.join(dir,'bad.json')],{encoding:'utf8'});assert.notEqual(bad.status,0);assert.equal(fs.existsSync(path.join(dir,'bad.json')),false);
});
