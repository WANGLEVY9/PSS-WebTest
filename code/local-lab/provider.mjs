import crypto from 'node:crypto';
import {responseFormat, actionResponseFormat} from './agent-protocol.mjs';

export const PROVIDER_PROTOCOL = 'pss-vlm-transport-v1';
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const positiveInt = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value)<1)
    throw Error('Invalid positive integer provider setting');
  return Number(value);
};

// GPT never inherits the legacy CUA key, model or endpoint. No silent vendor/model fallback.
export function resolveProvider(env, {requireKey=true}={}) {
  const provider=(env.PSS_LOCAL_PROVIDER || env.CUA_PROVIDER || '').trim();
  if (!['aliyun','openai','openai-compatible'].includes(provider))
    throw Error('Set PSS_LOCAL_PROVIDER to aliyun, openai or openai-compatible; Azure is not supported by this adapter');
  const gpt=provider!=='aliyun';
  const model=((gpt ? env.OPENAI_MODEL : env.PSS_LOCAL_MODEL || env.CUA_MODEL) || '').trim();
  if (!model || /[\r\n]/.test(model) || /REPLACE|YOUR_|<|>/i.test(model)) throw Error('An explicit authorized model ID is required');
  const apiKey=(gpt ? env.OPENAI_API_KEY : env.CUA_API_KEY || '')?.trim() || '';
  if ((requireKey && !apiKey) || /[\r\n]/.test(apiKey)) throw Error('Provider API key missing or invalid');
  const rawBase=gpt ? env.OPENAI_BASE_URL || (provider==='openai'?'https://api.openai.com/v1':'') : env.CUA_BASE_URL;
  let base;
  try {base=new URL(rawBase);} catch {throw Error('Provider API base URL missing or invalid');}
  if (base.protocol!=='https:' || base.username || base.password || base.search || base.hash)
    throw Error('Provider base must be HTTPS without credentials, query or fragment');
  if (provider==='openai' && (base.origin!=='https://api.openai.com' || base.pathname.replace(/\/$/,'')!=='/v1'))
    throw Error('Official OpenAI provider requires https://api.openai.com/v1; configure an explicitly approved compatible provider instead');
  if (provider==='openai-compatible' && env.PSS_OPENAI_ALLOWED_ORIGIN!==base.origin)
    throw Error('Compatible endpoint requires PSS_OPENAI_ALLOWED_ORIGIN matching its HTTPS origin');
  if (provider==='aliyun' && !/(^|\.)(aliyuncs\.com|aliyun\.com)$/.test(base.hostname))
    throw Error('Aliyun credentials require an Aliyun endpoint');
  if (/\/(responses|chat\/completions)\/?$/.test(base.pathname)) throw Error('Configure the API base, not a method URL');
  const api=gpt ? env.OPENAI_API_MODE || 'responses' : 'chat-completions';
  if (!['responses','chat-completions'].includes(api)) throw Error('OPENAI_API_MODE must be responses or chat-completions');
  const effort=gpt ? env.PSS_OPENAI_REASONING_EFFORT || null : null;
  if (effort && !['none','minimal','low','medium','high','xhigh','max'].includes(effort)) throw Error('Invalid reasoning effort');
  const config={provider,model,api,base_url:base.href.replace(/\/$/,''),
    max_output_tokens:positiveInt(env.PSS_LOCAL_MAX_OUTPUT_TOKENS,1024),reasoning_effort:effort,
    model_source:gpt?'OPENAI_MODEL':env.PSS_LOCAL_MODEL?'PSS_LOCAL_MODEL':'CUA_MODEL',
    transport_protocol:PROVIDER_PROTOCOL};
  Object.defineProperty(config,'apiKey',{value:apiKey,enumerable:false});
  return Object.freeze(config);
}

export function publicProvider(config) {
  const visible={...config};
  return {...visible,configuration_sha256:sha(JSON.stringify(visible))};
}

export function buildProviderRequest(config,{messages,controls=[],arm}) {
  if (!['visual','hybrid'].includes(arm)) throw Error('Provider may only serve agent arms');
  const format=config.provider==='aliyun' ? responseFormat(config.model,controls,arm) : actionResponseFormat(controls,arm);
  const common={model:config.model};
  if (config.api==='responses') {
    return {...common,store:false,max_output_tokens:config.max_output_tokens,
      ...(config.reasoning_effort?{reasoning:{effort:config.reasoning_effort}}:{}),
      input:messages.map(m=>({role:m.role,content:m.content.map(c=>{
        if(c.type==='text') return {type:'input_text',text:c.text};
        if(c.type==='image_url') return {type:'input_image',image_url:c.image_url.url,detail:'auto'};
        throw Error('Unexpected model-facing content type');
      })})),text:{format:{type:'json_schema',...format.json_schema}}};
  }
  return {...common,messages,response_format:format,
    ...(config.provider==='aliyun'
      ? {temperature:0,enable_thinking:false,max_tokens:config.max_output_tokens}
      : {store:false,max_completion_tokens:config.max_output_tokens,
         ...(config.reasoning_effort?{reasoning_effort:config.reasoning_effort}:{})})};
}

const token = n => Number.isSafeInteger(n) && n>=0 ? n : null;
export function parseProviderResponse(api,payload,{httpStatus=200,requestId=null}={}) {
  const usage=payload?.usage;
  const normalizedUsage=usage ? {
    input_tokens:token(usage.input_tokens ?? usage.prompt_tokens),
    output_tokens:token(usage.output_tokens ?? usage.completion_tokens),
    total_tokens:token(usage.total_tokens),
    cached_input_tokens:token(usage.input_tokens_details?.cached_tokens ?? usage.prompt_tokens_details?.cached_tokens),
    reasoning_output_tokens:token(usage.output_tokens_details?.reasoning_tokens ?? usage.completion_tokens_details?.reasoning_tokens),
  } : null;
  const record={http_status:httpStatus,provider_request_id:requestId,provider_response_id:payload?.id||null,
    model_returned:payload?.model||null,usage:normalizedUsage,finish_reason:null,output:null,failure_class:null};
  if(httpStatus<200 || httpStatus>=300) {
    const billingCodes=['insufficient_quota','credit_balance_exhausted','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded'];
    const billing=billingCodes.includes(payload?.error?.code)||payload?.error?.type==='insufficient_quota';
    record.failure_class=billing?'provider-budget':httpStatus===429?'provider-rate-limit':httpStatus===401||httpStatus===403?'provider-auth':httpStatus>=500?'provider-service':'provider-http';
    return record; // Never copy a provider error body: it may echo secrets or request data.
  }
  if(api==='responses') {
    const content=(Array.isArray(payload?.output)?payload.output:[]).filter(x=>x.type==='message').flatMap(x=>x.content||[]);
    record.finish_reason=payload?.status||null;
    if(content.some(c=>c.type==='refusal')) record.failure_class='provider-refusal';
    else if(payload?.status!=='completed') record.failure_class='provider-output-incomplete';
    else record.output=content.filter(c=>c.type==='output_text').map(c=>c.text).join('');
  } else {
    const choice=payload?.choices?.[0];
    record.finish_reason=choice?.finish_reason||null;
    if(choice?.message?.refusal) record.failure_class='provider-refusal';
    else if(choice?.finish_reason!=='stop') record.failure_class='provider-output-incomplete';
    else record.output=choice?.message?.content||null;
  }
  if(!record.failure_class && (typeof record.output!=='string' || !record.output.trim())) record.failure_class='provider-response-invalid';
  return record;
}

export async function callProvider(config,body,{timeoutMs,fetchImpl=fetch,budgetGuard,taskId}={}) {
  if(!config.apiKey) throw Error('Provider key is required');
  if(!Number.isInteger(timeoutMs) || timeoutMs<1) throw Error('Positive request time budget required');
  // Test transports can inject a fake fetch. Every real transport must reserve
  // from the deployment-wide ledger before any network side effect.
  if(fetchImpl===fetch&&!budgetGuard) throw Error('Shared spend guard required for live provider dispatch');
  const reservation=budgetGuard?.reserve(config,body,taskId);
  if(reservation) timeoutMs=Math.min(timeoutMs,reservation.remaining_ms,budgetGuard.policy.request_timeout_ms);
  const settle=response=>reservation?{...response,spend:reservation.settle(response)}:response;
  const start=Date.now(),controller=new AbortController();
  let timer,result;
  const expired=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new DOMException('Request deadline exceeded','TimeoutError'));},timeoutMs);});
  try {
    result=await Promise.race([expired,(async()=>{
    const res=await fetchImpl(`${config.base_url}/${config.api==='responses'?'responses':'chat/completions'}`,{
      method:'POST',redirect:'error',headers:{Authorization:`Bearer ${config.apiKey}`,'Content-Type':'application/json'},
      body:JSON.stringify(body),signal:controller.signal,
    });
    let payload;
    try {payload=await res.json();} catch(e) {
      if(/timeout|abort/i.test(e?.name)) throw e;
      return {...parseProviderResponse(config.api,null,{httpStatus:res.status}),failure_class:
        res.ok?'provider-response-invalid':res.status===429?'provider-rate-limit':res.status>=500?'provider-service':res.status===401||res.status===403?'provider-auth':'provider-http',latency_ms:Date.now()-start};
    }
    const retryAfter=res.headers?.get('retry-after');
    const retryAfterMs=retryAfter===null||retryAfter===undefined?null:/^\d+(?:\.\d+)?$/.test(retryAfter)?Number(retryAfter)*1000:Math.max(0,Date.parse(retryAfter)-Date.now());
    return {...parseProviderResponse(config.api,payload,{httpStatus:res.status,requestId:res.headers?.get('x-request-id')||null}),retry_after_ms:Number.isFinite(retryAfterMs)?retryAfterMs:null,latency_ms:Date.now()-start};
    })()]);
  } catch(e) {
    result={failure_class:/timeout|abort/i.test(e?.name)?'provider-timeout':'provider-network',
      http_status:null,usage:null,output:null,latency_ms:Date.now()-start};
  } finally {clearTimeout(timer);}
  if(reservation&&!result.failure_class&&result.model_returned!==config.model) {
    result.failure_class='provider-model-identity-unverified';
    result.output=null;
  }
  // Ledger errors propagate; they must not become retryable provider failures.
  return settle(result);
}
