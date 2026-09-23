// Transport only. Real framework prompts and native parsers remain upstream.
// The Python caller reserves each request in the durable ledger BEFORE dispatch.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {spendGuard} from './spend-guard.mjs';
import {loadRuntimeEnv} from './runtime-env.mjs';
import {resolveProvider,publicProvider,callProvider} from './provider.mjs';

export function frameworkBody(config, request) {
  if(request.model!==config.model || request.provider!==config.provider) throw Error('Frozen actor mismatch');
  if(!Array.isArray(request.messages)||!request.messages.length) throw Error('Framework messages required');
  const messages=request.messages.map(m=>{
    if(!['system','user','assistant'].includes(m.role)) throw Error('Unadmitted message role');
    const content=typeof m.content==='string'?[{type:'text',text:m.content}]:m.content;
    if(!Array.isArray(content)) throw Error('Message content required');
    return {role:m.role,content:content.map(c=>{
      if(c.type==='text'&&typeof c.text==='string')return {type:'text',text:c.text};
      if(c.type==='image_url'&&/^data:image\/(png|jpeg|webp);base64,/.test(c.image_url?.url||''))
        return {type:'image_url',image_url:{url:c.image_url.url,detail:'high'}};
      throw Error('Only text and embedded public task/screenshot images allowed');
    })};
  });
  if(request.schema && (typeof request.schema!=='object'||request.schema.type!=='object')) throw Error('Native object schema required');
  if(config.api==='responses')return {model:config.model,store:false,max_output_tokens:config.max_output_tokens,
    ...(config.reasoning_effort?{reasoning:{effort:config.reasoning_effort}}:{}),
    input:messages.map(m=>({role:m.role,content:m.content.map(c=>c.type==='text'?{type:'input_text',text:c.text}:{type:'input_image',image_url:c.image_url.url,detail:'high'})})),
    ...(request.schema?{text:{format:{type:'json_schema',name:'native_framework_action',strict:false,schema:request.schema}}}:{})};
  return {model:config.model,messages,
    ...(config.provider==='aliyun'?{temperature:0,enable_thinking:false,max_tokens:config.max_output_tokens}:
      {store:false,max_completion_tokens:config.max_output_tokens,...(config.reasoning_effort?{reasoning_effort:config.reasoning_effort}:{})}),
    ...(request.schema?{response_format:{type:'json_schema',json_schema:{name:'native_framework_action',strict:false,schema:request.schema}}}:{})};
}

export function dispatchFramework(config,input,{budgetGuard,fetchImpl}={}) {
  return callProvider(config,frameworkBody(config,input),{timeoutMs:input.timeout_ms,includeRaw:true,
    budgetGuard,taskId:input.spend_task_id,...(fetchImpl?{fetchImpl}:{})});
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const input=JSON.parse(fs.readFileSync(0,'utf8'));
    const env=loadRuntimeEnv();
    const config=resolveProvider(env);
    const result=await dispatchFramework(config,input,{budgetGuard:spendGuard(env)});
    // stdout is a private IPC stream captured by the actor, not console output.
    console.log(JSON.stringify({...result,configuration:publicProvider(config)}));
  } catch {console.log(JSON.stringify({failure_class:'provider-bridge-configuration',output:null,usage:null}));process.exitCode=2;}
}
