import test from 'node:test';
import assert from 'node:assert/strict';
import {createVolcengineCuaDriver} from '../../src/arms/volcengine-cua-driver.mjs';
const env={CUA_PROVIDER:'aliyun',CUA_MODEL:'qwen3-vl-flash',CUA_API_KEY:'synthetic-placeholder',CUA_BASE_URL:'https://example.test/v1',CUA_MAX_DECISION_RETRIES:'1'};
const options={env,observeScreenshot:async()=> 'fixture',executeAction:async()=>{},maxRetries:1,timeoutMs:20,wallTimeoutMs:40};
test('legacy JSON body cannot escape request deadline and late done is never accepted',async()=>{
 let signal;const d=createVolcengineCuaDriver({...options,fetchImpl:async(u,i)=>{signal=i.signal;return {ok:true,status:200,json:()=>new Promise(()=>{})};}});
 const started=performance.now();
 await assert.rejects(()=>d.decide({intent:'fixture',observation:{screenshot:'fixture'},step:0}),/deadline|wall-time/);
 assert.ok(performance.now()-started<500);assert.equal(signal.aborted,true);
});
test('network and decision-repair budgets cannot multiply provider attempts',async()=>{
 let calls=0;const events=[];
 const d=createVolcengineCuaDriver({...options,onProviderResponse:r=>events.push(r),fetchImpl:async()=>{calls++;throw Error('synthetic delivery unknown');}});
 await assert.rejects(()=>d.decide({intent:'fixture',observation:{screenshot:'fixture'},step:0}));
 assert.equal(calls,1);assert.equal(events.length,1);
 assert.equal(d.getProtocolResolution().transport_revision,'single-owner-body-deadline-v2');
});
test('authentication errors are not model repair opportunities',async()=>{
 let calls=0;
 const d=createVolcengineCuaDriver({...options,fetchImpl:async()=>{calls++;return {ok:false,status:401,json:async()=>({error:{message:'do not echo secrets'}})};}});
 await assert.rejects(()=>d.decide({intent:'fixture',observation:{screenshot:'fixture'},step:0}),/401/);
 assert.equal(calls,1);
});
import {createVolcengineHybridDriver} from '../../src/arms/volcengine-hybrid-driver.mjs';
test('hybrid uses the same body deadline and non-replay transport policy',async()=>{
 let calls=0;
 const d=createVolcengineHybridDriver({...options,observeHybrid:async()=>({screenshot:'fixture',pageStructure:{}}),fetchImpl:async()=>{calls++;return {ok:true,status:200,json:()=>new Promise(()=>{})};}});
 await assert.rejects(()=>d.decide({intent:'fixture',observation:{screenshot:'fixture',pageStructure:{}},step:0}),/deadline|wall-time/);
 assert.equal(calls,1);
});
