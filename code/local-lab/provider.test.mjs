import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {resolveProvider,publicProvider,buildProviderRequest,parseProviderResponse,callProvider} from './provider.mjs';
import {modelMessages,parseDecision} from './agent-protocol.mjs';
import {loadRuntimeEnv} from './runtime-env.mjs';
const env={PSS_LOCAL_PROVIDER:'openai',OPENAI_MODEL:'authorized-model-fixture',OPENAI_API_KEY:'synthetic-test-key'};
const messages=modelMessages('Choose one action. JSON only.',[], 'data:image/png;base64,fixture');
test('OpenAI is explicit, key is nonserializable, legacy vendor settings never bleed across',()=>{
  const c=resolveProvider({...env,CUA_API_KEY:'WRONG_KEY',CUA_MODEL:'WRONG_MODEL',CUA_BASE_URL:'https://wrong.example',PSS_LOCAL_MODEL:'WRONG_OVERRIDE'});
  assert.equal(c.model,env.OPENAI_MODEL);assert.equal(c.apiKey,env.OPENAI_API_KEY);
  assert.equal(c.base_url,'https://api.openai.com/v1');
  assert.doesNotMatch(JSON.stringify(c),/test-key|WRONG/);
  assert.doesNotMatch(JSON.stringify(publicProvider(c)),/test-key|WRONG/);
  assert.throws(()=>resolveProvider({...env,OPENAI_API_KEY:'',CUA_API_KEY:'legacy'}),/key/);
  assert.throws(()=>resolveProvider({...env,OPENAI_MODEL:'',CUA_MODEL:'legacy'}),/model/);
});
test('endpoint and credentials cannot silently move to another vendor or insecure host',()=>{
  for(const url of ['http://api.openai.com/v1','https://attacker.example/v1','https://user:pass@api.openai.com/v1','https://api.openai.com/v1?key=secret','https://api.openai.com/v1/responses'])
    assert.throws(()=>resolveProvider({...env,OPENAI_BASE_URL:url}));
  assert.throws(()=>resolveProvider({...env,PSS_LOCAL_PROVIDER:'azure'}));
  const proxy={...env,PSS_LOCAL_PROVIDER:'openai-compatible',OPENAI_BASE_URL:'https://sponsor.example/v1'};
  assert.throws(()=>resolveProvider(proxy),/origin/);
  assert.equal(resolveProvider({...proxy,PSS_OPENAI_ALLOWED_ORIGIN:'https://sponsor.example'}).api,'responses');
});
test('Responses payload uses image inputs and strict schema without hidden-state or reasoning tools',()=>{
  const b=buildProviderRequest(resolveProvider(env),{messages,controls:[{target_id:'SECRET_DOM'}],arm:'visual'});
  assert.equal(b.store,false);assert.equal(b.input[0].content.at(-1).type,'input_image');
  assert.equal(b.max_output_tokens,1024);assert.equal(b.text.format.strict,true);
  assert.doesNotMatch(JSON.stringify(b),/SECRET_DOM|enable_thinking|temperature|previous_response_id|"tools"/);
  const h=buildProviderRequest(resolveProvider(env),{messages,controls:[{target_id:'o1-c0'}],arm:'hybrid'});
  assert.deepEqual(h.text.format.schema.properties.target_id.enum,[null,'o1-c0']);
});
test('Chat mode uses its own token parameter and never sends Qwen extension fields to GPT',()=>{
  const b=buildProviderRequest(resolveProvider({...env,OPENAI_API_MODE:'chat-completions',PSS_OPENAI_REASONING_EFFORT:'low'}),{messages,arm:'visual'});
  assert.equal(b.max_completion_tokens,1024);assert.equal(b.reasoning_effort,'low');
  assert.equal(b.enable_thinking,undefined);assert.equal(b.max_tokens,undefined);assert.equal(b.temperature,undefined);
});
test('existing Aliyun branch keeps its declared request parameters',()=>{
  const c=resolveProvider({CUA_PROVIDER:'aliyun',CUA_MODEL:'qwen3.7-flash',CUA_API_KEY:'test',CUA_BASE_URL:'https://dashscope.aliyuncs.com/compatible-mode/v1'});
  const b=buildProviderRequest(c,{messages,arm:'visual'});
  assert.equal(b.enable_thinking,false);assert.equal(b.max_tokens,1024);assert.equal(b.temperature,0);
});
const completed={id:'response-test',model:'returned-model',status:'completed',
  output:[{type:'reasoning',summary:[{text:'DO_NOT_RECORD'}]},{type:'message',content:[{type:'output_text',text:'{"action":"wait"}'}]}],
  usage:{input_tokens:20,output_tokens:10,total_tokens:30,input_tokens_details:{cached_tokens:4},output_tokens_details:{reasoning_tokens:3}}};
test('HTTP Responses are parsed from message output, not SDK-only output_text; reasoning is not logged',()=>{
  const r=parseProviderResponse('responses',completed,{requestId:'http-id'});
  assert.equal(parseDecision(r.output,{arm:'visual'}).action,'wait');
  assert.equal(r.provider_request_id,'http-id');assert.equal(r.provider_response_id,'response-test');
  assert.equal(r.usage.total_tokens,30);assert.equal(r.usage.reasoning_output_tokens,3);
  assert.doesNotMatch(JSON.stringify(r),/DO_NOT_RECORD/);
});
test('refusal, incomplete output and empty response never become executed actions',()=>{
  assert.equal(parseProviderResponse('responses',{...completed,status:'incomplete'}).failure_class,'provider-output-incomplete');
  assert.equal(parseProviderResponse('responses',{...completed,output:[]}).failure_class,'provider-response-invalid');
  assert.equal(parseProviderResponse('responses',{...completed,output:[{type:'message',content:[{type:'refusal',refusal:'no'}]}]}).failure_class,'provider-refusal');
  assert.equal(parseProviderResponse('chat-completions',{choices:[{finish_reason:'length',message:{content:'{"action":"wait"}'}}]}).failure_class,'provider-output-incomplete');
});
test('HTTP error categories preserve failure boundary without echoing error bodies',()=>{
  for(const [status,category] of [[401,'provider-auth'],[403,'provider-auth'],[429,'provider-rate-limit'],[500,'provider-service'],[400,'provider-http']]) {
    const r=parseProviderResponse('responses',{error:{message:'SECRET_KEY'}},{httpStatus:status});
    assert.equal(r.failure_class,category);assert.doesNotMatch(JSON.stringify(r),/SECRET_KEY/);
  }
  assert.equal(parseProviderResponse('responses',{...completed,usage:undefined}).usage,null);
});
test('transport does one bounded request, refuses redirects, and records the API family',async()=>{
  let calls=0;
  const c=resolveProvider(env),body=buildProviderRequest(c,{messages,arm:'visual'});
  const r=await callProvider(c,body,{timeoutMs:500,fetchImpl:async(url,init)=>{
    calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(init.redirect,'error');
    assert.equal(init.headers.Authorization,'Bearer synthetic-test-key');assert.ok(init.signal);
    return {status:200,ok:true,headers:new Headers({'x-request-id':'request-test'}),json:async()=>completed};
  }});
  assert.equal(calls,1);assert.equal(r.failure_class,null);assert.equal(r.provider_request_id,'request-test');
});
test('timeouts and invalid JSON are classified, with no retries or raw exception echo',async()=>{
  const c=resolveProvider(env);
  for(const [name,failure] of [['TimeoutError','provider-timeout'],['TypeError','provider-network']]) {
    let calls=0;const r=await callProvider(c,{}, {timeoutMs:100,fetchImpl:async()=>{calls++;const e=new Error('SECRET_KEY');e.name=name;throw e;}});
    assert.equal(r.failure_class,failure);assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(r),/SECRET_KEY/);
  }
  const bad=await callProvider(c,{}, {timeoutMs:100,fetchImpl:async()=>({ok:true,status:200,json:async()=>{throw new SyntaxError('secret HTML');}})});
  assert.equal(bad.failure_class,'provider-response-invalid');
});
test('isolated sponsor env file excludes inherited model, key and run switches',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pss-env-test-')),file=path.join(dir,'.env');
  try {
    fs.writeFileSync(file,'PSS_LOCAL_PROVIDER=openai\nOPENAI_MODEL=fixture\n');
    const loaded=loadRuntimeEnv({PSS_LOCAL_ENV_FILE:file,CUA_API_KEY:'old',OPENAI_API_KEY:'old',PSS_LOCAL_ALLOW_DIAGNOSTIC_RUN:'1',PSS_AUX_ENABLED:'1',PSS_AUX_MODEL:'inherited',PATH:'/bin'});
    assert.equal(loaded.CUA_API_KEY,undefined);assert.equal(loaded.OPENAI_API_KEY,undefined);
    assert.equal(loaded.PSS_LOCAL_ALLOW_DIAGNOSTIC_RUN,undefined);assert.equal(loaded.PATH,'/bin');
    assert.equal(loaded.OPENAI_MODEL,'fixture');
    assert.equal(loaded.PSS_AUX_ENABLED,undefined);assert.equal(loaded.PSS_AUX_MODEL,undefined);
  } finally {fs.rmSync(dir,{recursive:true});}
});
