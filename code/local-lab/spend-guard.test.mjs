import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spendGuard} from './spend-guard.mjs';
import {callProvider} from './provider.mjs';

const config={provider:'openai',model:'SYNTHETIC_FIXTURE',base_url:'https://api.openai.com/v1',api:'responses',apiKey:'not-a-real-key'};
const body={model:config.model,max_output_tokens:10,input:[]};
function fixture(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'spend-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const policy=JSON.parse(fs.readFileSync(new URL('../config/spend-policy.json',import.meta.url)));
  policy.rates=[{provider:config.provider,model:config.model,base_url:config.base_url,
    input_usd_per_million:1,cached_input_usd_per_million:1,output_usd_per_million:2,
    max_input_tokens:100,max_output_tokens:10,source:'SYNTHETIC_FIXTURE_NOT_REAL_PRICING',
    verified_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()}];
  const file=path.join(dir,'policy.json');fs.writeFileSync(file,JSON.stringify(policy));
  const env={PSS_SPEND_POLICY_FILE:file,PSS_SPEND_DB:path.join(dir,'shared.sqlite')};
  return {guard:spendGuard(env),env,policy,file};
}
const response=()=>({ok:true,status:200,headers:new Headers(),json:async()=>({model:config.model,status:'completed',
  usage:{input_tokens:10,output_tokens:2,input_tokens_details:{cached_tokens:0}},
  output:[{type:'message',content:[{type:'output_text',text:'fixture'}]}]})});

test('unconfigured pricing blocks before network; real transport requires a shared guard',async t=>{
  const f=fixture(t);f.policy.rates=[];fs.writeFileSync(f.file,JSON.stringify(f.policy));
  let calls=0;
  await assert.rejects(callProvider(config,body,{timeoutMs:100,budgetGuard:spendGuard(f.env),taskId:'t',fetchImpl:async()=>{calls++;return response();}}),/rate card/);
  await assert.rejects(callProvider(config,body,{timeoutMs:100}),/Shared spend guard/);
  assert.equal(calls,0);
});
test('actual transport wrapper reserves, settles, and never records prompt or key',async t=>{
  const {guard}=fixture(t);
  const r=await callProvider(config,body,{timeoutMs:1000,budgetGuard:guard,taskId:'campaign/opportunity',fetchImpl:async()=>response()});
  assert.equal(r.spend.charge_micro_cny,112);
  const s=guard.status(config);
  assert.equal(s.known_micro_cny,112);assert.equal(s.held_micro_cny,0);assert.equal(s.tasks[0].requests,1);
  assert.doesNotMatch(JSON.stringify(s),/not-a-real-key/);
});
test('ambiguous network delivery retains full reservation and pause stops fetch',async t=>{
  const {guard}=fixture(t);let calls=0;
  const fake=async()=>{calls++;throw Error('network lost');};
  await callProvider(config,body,{timeoutMs:1000,budgetGuard:guard,taskId:'t',fetchImpl:fake});
  assert.equal(guard.status(config).held_micro_cny,960);
  guard.pause(true);
  await assert.rejects(callProvider(config,body,{timeoutMs:1000,budgetGuard:guard,taskId:'t',fetchImpl:fake}),/paused/);
  assert.equal(calls,1);
});
test('unpriced features, changed endpoint and excessive output fail before dispatch',t=>{
  const {guard}=fixture(t);
  assert.throws(()=>guard.reserve(config,{...body,tools:[{}]},'t'),/Unpriced/);
  assert.throws(()=>guard.reserve(config,{...body,input:[{content:[{type:'input_audio'}]}]},'t'),/Unpriced/);
  assert.throws(()=>guard.reserve(config,{...body,max_output_tokens:11},'t'),/Unbounded/);
  assert.throws(()=>guard.reserve({...config,base_url:'https://elsewhere.invalid'},body,'t'),/rate card/);
  assert.throws(()=>guard.reserve(config,body,null),/task identity/);
});
test('policy mutation during a bound call is rejected; no stale conversion reaches dispatch',t=>{
  const {guard,policy,file}=fixture(t);
  policy.fx_cny_per_usd=1;fs.writeFileSync(file,JSON.stringify(policy));
  assert.throws(()=>guard.reserve(config,body,'t'),/changed after provider binding/);
});
test('provider quota exhaustion pauses later tasks without releasing uncertain charges',async t=>{
  const {guard}=fixture(t);let calls=0;
  const fake=async()=>{calls++;return {...response(),status:429,ok:false,json:async()=>({error:{code:'project_spend_limit_exceeded'}})};};
  const r=await callProvider(config,body,{timeoutMs:1000,budgetGuard:guard,taskId:'t',fetchImpl:fake});
  assert.equal(r.failure_class,'provider-budget');assert.equal(guard.status(config).paused,true);
  await assert.rejects(callProvider(config,body,{timeoutMs:1000,budgetGuard:guard,taskId:'next-task',fetchImpl:fake}),/paused/);
  assert.equal(calls,1);assert.equal(guard.status(config).held_micro_cny,960);
});
test('returned model mismatch cannot execute an unpriced action',async t=>{
  const {guard}=fixture(t);
  const payload=await response().json();payload.model='different-model';
  const r=await callProvider(config,body,{timeoutMs:1000,budgetGuard:guard,taskId:'t',
    fetchImpl:async()=>({...response(),json:async()=>payload})});
  assert.equal(r.output,null);assert.equal(r.failure_class,'provider-model-identity-unverified');
  assert.equal(guard.status(config).paused,true);assert.equal(guard.status(config).held_micro_cny,960);
});
