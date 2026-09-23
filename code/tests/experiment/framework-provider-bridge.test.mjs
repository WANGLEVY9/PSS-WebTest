import test from 'node:test';
import assert from 'node:assert/strict';
import {frameworkBody,dispatchFramework} from '../../experiment/framework-provider-bridge.mjs';
import {responseFormat} from '../../experiment/agent-protocol.mjs';
const config={provider:'aliyun',model:'qwen3.8-max',api:'chat-completions',max_output_tokens:1000};
const request={provider:'aliyun',model:'qwen3.8-max',messages:[{role:'user',content:[{type:'text',text:'public task'},{type:'image_url',image_url:{url:'data:image/png;base64,AAAA'}}]}]};
test('Qwen3.8 explicitly requests object schema; legacy VL remains json_object',()=>{
  assert.equal(responseFormat('qwen3.8-max',[],'visual').type,'json_schema');
  assert.equal(responseFormat('qwen3.8-flash-0902',[],'visual').type,'json_schema');
  assert.equal(responseFormat('qwen3-vl-flash',[],'visual').type,'json_object');
});
test('AgentLab keeps native text/XML protocol instead of PSS JSON action schema',()=>{
  const body=frameworkBody(config,request);
  assert.equal(body.response_format,undefined);
  assert.equal(body.enable_thinking,false);
  assert.equal(body.messages[0].content[1].image_url.detail,'high');
});
test('Browser Use native schema preserved; no invented result repair',()=>{
  const schema={type:'object',properties:{action:{type:'array'}}};
  assert.deepEqual(frameworkBody(config,{...request,schema}).response_format.json_schema.schema,schema);
});
test('frozen identity and embedded image boundary',()=>{
  assert.throws(()=>frameworkBody(config,{...request,model:'other'}));
  assert.throws(()=>frameworkBody(config,{...request,messages:[{role:'tool',content:'secret'}]}));
  assert.throws(()=>frameworkBody(config,{...request,messages:[{role:'user',content:[{type:'image_url',image_url:{url:'https://external.test/img'}}]}]}));
});
test('OpenAI Responses maps the same framework content; never enables tools/search',()=>{
  const body=frameworkBody({...config,provider:'openai',model:'sponsor-selected',api:'responses'},{...request,provider:'openai',model:'sponsor-selected'});
  assert.equal(body.store,false);assert.equal(body.input[0].content[1].type,'input_image');assert.equal(body.tools,undefined);
});

test('native dispatch reserves stable opportunity and preserves raw output without a live request',async()=>{
  const events=[];const c={...config,apiKey:'SYNTHETIC_NOT_A_KEY',base_url:'https://synthetic.invalid'};
  const input={...request,spend_task_id:'SYNTHETIC_OPPORTUNITY',timeout_ms:1000};
  const budgetGuard={policy:{request_timeout_ms:1000},reserve(actual,body,id){
    assert.equal(actual,c);assert.equal(id,input.spend_task_id);assert.equal(body.model,c.model);events.push('reserve');
    return {remaining_ms:1000,settle(result){events.push('settle');assert.equal(result.output,'original');return {request_id:'synthetic-reservation'};}};
  }};
  const fetchImpl=async()=>{events.push('fetch');return {ok:true,status:200,headers:new Headers(),json:async()=>({model:c.model,choices:[{finish_reason:'stop',message:{content:'original'}}],usage:{prompt_tokens:1,completion_tokens:1}})};};
  const result=await dispatchFramework(c,input,{budgetGuard,fetchImpl});
  assert.deepEqual(events,['reserve','fetch','settle']);assert.equal(result.raw_output,'original');assert.equal(result.spend.request_id,'synthetic-reservation');
});
test('native dispatch blocks before fetch on shared budget rejection',async()=>{
  let calls=0;
  await assert.rejects(dispatchFramework({...config,apiKey:'SYNTHETIC_NOT_A_KEY'}, {...request,timeout_ms:1000}, {
    budgetGuard:{reserve(){throw Error('synthetic exhausted budget');}},fetchImpl:async()=>{calls++;}
  }),/exhausted budget/);
  assert.equal(calls,0);
});
