import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveProvider,publicProvider} from './provider.mjs';
import {actorRoute,auditActorRouting,auxiliaryProvider,triageEnvelope,triageFailure} from './model-routing.mjs';
const env={PSS_LOCAL_PROVIDER:'openai',OPENAI_MODEL:'fixed-actor',OPENAI_API_KEY:'synthetic-secret',PSS_AUX_ENABLED:'1',PSS_AUX_MODEL:'gpt-5.6-luna'};
const record={finished_at:'synthetic-end',status:'failed',failure_class:'provider-timeout',actions:[],requests:[{http_status:429,latency_ms:15,prompt_text:'SECRET',output:'SECRET'}],oracle:{answer:'SECRET'},pageStructure:'SECRET',url:'SECRET'};
test('audit detects actor routing drift but does not invent policy provenance for legacy records',()=>{
  const config=resolveProvider(env),route=actorRoute(config);
  const batch={provider_configuration:publicProvider(config),model_routing:route,records:[{record_id:'v',requests:[{model_requested:config.model,provider:config.provider,model_routing:route}]}]};
  assert.equal(auditActorRouting(batch).status,'verified');
  batch.records[0].requests[0].model_requested='other';assert.equal(auditActorRouting(batch).status,'invalid');
  assert.equal(auditActorRouting({}).status,'legacy-unrecorded');
});
test('auxiliary configuration cannot change the fixed actor or cause fallback',()=>{
  const c=resolveProvider(env),a=actorRoute(c),aux=auxiliaryProvider(env);
  assert.equal(a.model,'fixed-actor');assert.equal(aux.model,'gpt-5.6-luna');assert.equal(a.fallback_allowed,false);assert.equal(a.auxiliary_feedback_allowed,false);
  assert.equal(actorRoute(c).policy_sha256,a.policy_sha256);assert.notEqual(actorRoute(aux).policy_sha256,a.policy_sha256);
  assert.throws(()=>auxiliaryProvider({...env,PSS_AUX_ENABLED:'0'}),/disabled/);
  assert.doesNotMatch(JSON.stringify(a),/synthetic-secret/);
});
test('triage whitelist rejects active runs and withholds all free text and gold',()=>{
  assert.doesNotMatch(JSON.stringify(triageEnvelope(record)),/SECRET|oracle|pageStructure|url|prompt/);
  assert.throws(()=>triageEnvelope({...record,finished_at:null}),/terminal/);
  assert.throws(()=>triageEnvelope({...record,status:'running'}),/terminal/);
  assert.equal(triageEnvelope({...record,failure_class:'SECRET'}).failure_signal,'unclassified');
});
test('one low-cost auxiliary call gives a provisional annotation, never a task action',async()=>{
  let n=0;const before=JSON.stringify(record);
  const result=await triageFailure(auxiliaryProvider(env),record,{fetchImpl:async(url,init)=>{
    n++;const body=JSON.parse(init.body);assert.equal(body.model,'gpt-5.6-luna');assert.equal(body.store,false);
    assert.doesNotMatch(init.body,/SECRET|input_image|oracle|target_id/);
    return {status:200,ok:true,headers:new Headers(),json:async()=>({status:'completed',model:'gpt-5.6-luna',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({hypothesis:'provider_or_transport',next_check:'check_provider_telemetry'})}]}]})};
  }});
  assert.equal(n,1);assert.equal(result.changes_outcome,false);assert.equal(result.requires_human_review,true);assert.equal(result.annotation.hypothesis,'provider_or_transport');assert.equal(JSON.stringify(record),before);
});
test('extra model fields and HTTP failure do not create an annotation',async()=>{
  const c=auxiliaryProvider(env);
  const a=await triageFailure(c,record,{fetchImpl:async()=>({status:429,ok:false,headers:new Headers(),json:async()=>({error:'SECRET'})})});
  assert.equal(a.failure_class,'provider-rate-limit');assert.equal(a.annotation,null);
  const b=await triageFailure(c,record,{fetchImpl:async()=>({status:200,ok:true,headers:new Headers(),json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"action":"click"}'}]}]})})});
  assert.equal(b.failure_class,'auxiliary-output-contract');assert.equal(b.annotation,null);
});
