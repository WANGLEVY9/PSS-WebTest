import test from 'node:test';
import assert from 'node:assert/strict';
import {accountedProvider,costMicroUsd} from '../../experiment/reliable-provider.mjs';
import {callProvider,resolveProvider} from '../../experiment/provider.mjs';
import {actorRoute,auditActorRouting} from '../../experiment/model-routing.mjs';
const config=resolveProvider({PSS_LOCAL_PROVIDER:'openai',OPENAI_MODEL:'fixture',OPENAI_API_KEY:'synthetic-test-only'});
const price={provider:'openai',model:'fixture',source:'SYNTHETIC_TEST',effective_at:'test',input_usd_per_million:2,cached_input_usd_per_million:1,output_usd_per_million:4};
const response=(status=200)=>({status,ok:status===200,headers:new Headers(),json:async()=>({model:'fixture',status:'completed',usage:{input_tokens:10,output_tokens:5,input_tokens_details:{cached_tokens:2},output_tokens_details:{reasoning_tokens:3}},output:[{type:'message',content:[{type:'output_text',text:'fixture'}]}]})});
const ledger=()=>({events:[],reserve(id,identity,reservation){this.events.push({type:'reserve',id,identity,reservation});},settle(id,telemetry,charge){this.events.push({type:'settle',id,telemetry,charge});}});
test('one owner retries only explicit transient HTTP errors and accounts for all attempts',async()=>{
 const l=ledger();let calls=0;
 const r=await accountedProvider(config,{model:'fixture'},{ledger:l,price,reservationMicroUsd:100,maxAttempts:3,deadlineMs:5000,sleep:async()=>{},fetchImpl:async()=>response(++calls<3?429:200)});
 assert.equal(calls,3);assert.equal(r.attempts.length,3);assert.equal(l.events.length,6);assert.equal(r.failure_class,null);assert.equal(r.attempts[2].charge_micro_usd,38);
 assert.doesNotMatch(JSON.stringify(l.events),/synthetic-test-only|"output":"fixture"/);
});
test('ambiguous network delivery is not replayed and unknown cost is never zero',async()=>{
 const l=ledger();let calls=0;
 const r=await accountedProvider(config,{model:'fixture'},{ledger:l,price,reservationMicroUsd:100,maxAttempts:3,deadlineMs:1000,fetchImpl:async()=>{calls++;throw Error('network');}});
 assert.equal(calls,1);assert.equal(r.failure_class,'provider-network');assert.equal(l.events[1].charge,null);
});
test('body read has a hard deadline even if a test transport ignores AbortSignal',async()=>{
 let signal;const started=performance.now();
 const r=await callProvider(config,{model:'fixture'},{timeoutMs:20,fetchImpl:async(u,init)=>{signal=init.signal;return {...response(),json:()=>new Promise(()=>{})};}});
 assert.equal(r.failure_class,'provider-timeout');assert.equal(signal.aborted,true);assert.ok(performance.now()-started<500);
});
test('Retry-After larger than remaining budget prevents another request',async()=>{
 let calls=0;
 const r=await accountedProvider(config,{model:'fixture'},{ledger:ledger(),reservationMicroUsd:100,maxAttempts:3,deadlineMs:1000,fetchImpl:async()=>{calls++;return {...response(429),headers:new Headers({'retry-after':'60'})};}});
 assert.equal(calls,1);assert.equal(r.attempts[0].retry_after_ms,60000);
});
test('cached and reasoning subsets are not charged twice; missing pricing remains unknown',()=>{
 assert.equal(costMicroUsd({input_tokens:10,output_tokens:5,cached_input_tokens:2,reasoning_output_tokens:3},price),38);
 assert.equal(costMicroUsd({input_tokens:10,output_tokens:5,cached_input_tokens:null},price),null);
 assert.equal(costMicroUsd(null,price),null);
 assert.throws(()=>costMicroUsd({input_tokens:1,output_tokens:1,cached_input_tokens:2},price),/cached/);
});
test('returned model is independently audited; aliases must be frozen in configuration',()=>{
 function batch(returned,aliases=[]) {const c={...config,approved_model_returned_aliases:aliases},route=actorRoute(c);return {provider_configuration:c,model_routing:route,records:[{record_id:'r',requests:[{model_routing:route,model_requested:'fixture',model_returned:returned,provider:'openai'}]}]};}
 assert.equal(auditActorRouting(batch('other')).status,'invalid');
 assert.equal(auditActorRouting(batch(null)).status,'unverified');
 assert.equal(auditActorRouting(batch('fixture-dated',['fixture-dated'])).status,'verified');
});
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {requestLedger} from '../../experiment/runtime-ledger.mjs';
test('billing quota 429 is terminal, never retried like a transient rate limit',async()=>{
 let calls=0;
 const result=await accountedProvider(config,{model:'fixture'},{ledger:ledger(),reservationMicroUsd:100,maxAttempts:3,deadlineMs:1000,
   fetchImpl:async()=>{calls++;return {...response(429),json:async()=>({error:{code:'project_spend_limit_exceeded',message:'private body'}})};}});
 assert.equal(calls,1);assert.equal(result.failure_class,'provider-budget');
 assert.doesNotMatch(JSON.stringify(result),/private body/);
});
test('provider attempts persist through the real Node/Python SQLite bridge',async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pss-request-ledger-')),database=path.join(temp,'ledger.sqlite');
 const cwd=fileURLToPath(new URL('../../experiment/',import.meta.url));
 try {
   const init=spawnSync('python3',['-c',"from runtime_store import Store; import sys,json; s=Store(sys.argv[1]); s.enqueue([{'opportunity_id':'fixture','environment_id':'test','schedule_sha256':'a'*64}]); o=s.claim(); s.start('fixture',o['lease_token']); print(json.dumps(o)); s.close()",database],{cwd,encoding:'utf8'});
   assert.equal(init.status,0,init.stderr);const token=JSON.parse(init.stdout).lease_token;
   const l=requestLedger({database,opportunityId:'fixture',leaseToken:token,capMicroUsd:1000});
   const result=await accountedProvider(config,{model:'fixture'},{ledger:l,price,reservationMicroUsd:100,deadlineMs:5000,fetchImpl:async()=>response()});
   assert.equal(result.failure_class,null);
   const read=spawnSync('python3',['-c','from runtime_store import Store; import sys,json; s=Store(sys.argv[1]); print(json.dumps(s.summary())); s.close()',database],{cwd,encoding:'utf8'});
   assert.equal(read.status,0,read.stderr);const report=JSON.parse(read.stdout);
   assert.equal(report.attempts,1);assert.equal(report.total_micro_usd,38);assert.equal(report.reservation_overrun,false);
 } finally {fs.rmSync(temp,{recursive:true});}
});

test('invalid rate cards fail before dispatch and malformed usage remains durably unknown',async()=>{
 let calls=0;const options={ledger:ledger(),price:{...price,input_usd_per_million:-1},reservationMicroUsd:100,deadlineMs:1000,fetchImpl:async()=>{calls++;return response();}};
 await assert.rejects(()=>accountedProvider(config,{model:'fixture'},options),/rate card/);assert.equal(calls,0);
 const l=ledger();const r=await accountedProvider(config,{model:'fixture'},{...options,ledger:l,price,fetchImpl:async()=>({...response(),json:async()=>({model:'fixture',status:'completed',usage:{input_tokens:1,output_tokens:1,input_tokens_details:{cached_tokens:2}},output:[{type:'message',content:[{type:'output_text',text:'fixture'}]}]})})});
 assert.equal(r.attempts[0].charge_micro_usd,null);assert.equal(l.events[1].telemetry.accounting_error,'invalid-provider-usage');
});
