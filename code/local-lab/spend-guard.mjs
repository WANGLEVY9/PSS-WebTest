import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const code=fileURLToPath(new URL('../',import.meta.url));
const script=fileURLToPath(new URL('./spend_guard.py',import.meta.url));
export function spendGuard(env=process.env) {
  const policyFile=path.resolve(env.PSS_SPEND_POLICY_FILE||path.join(code,'config/spend-policy.json'));
  // Shared across batches and runtime databases; never use a per-run directory.
  const database=path.resolve(env.PSS_SPEND_DB||path.join(code,'artifacts/private/shared-spend.sqlite'));
  const policyBytes=fs.readFileSync(policyFile);
  const policy=JSON.parse(policyBytes);
  const policyFileSha=crypto.createHash('sha256').update(policyBytes).digest('hex');
  const invoke=(command,payload={})=>{
    const r=spawnSync(env.PSS_PYTHON||'python3',[script,command,database,policyFile],{
      input:JSON.stringify({...payload,policy_file_sha256:policyFileSha}),encoding:'utf8',timeout:15000});
    let result;
    try {result=JSON.parse(r.stdout);} catch {throw Error('Budget ledger unavailable; dispatch blocked');}
    if(r.status!==0) {
      const error=Error(result.error||'Budget ledger rejected operation');
      error.code='PSS_SPEND_BLOCKED';
      throw error;
    }
    return result;
  };
  function rateFor(config) {
    if(!Number.isFinite(policy.fx_cny_per_usd)||policy.fx_cny_per_usd<=0) throw Error('Billing conversion unavailable');
    const rates=policy.rates?.filter(r=>r.provider===config.provider&&r.model===config.model&&r.base_url===config.base_url);
    if(rates?.length!==1) throw Error('Verified provider/model/endpoint rate card required');
    const rate=rates[0];
    if(!rate.source||!Number.isFinite(Date.parse(rate.verified_at))||Date.parse(rate.verified_at)>Date.now()||
      !Number.isFinite(Date.parse(rate.expires_at))||Date.parse(rate.expires_at)<=Date.now())
      throw Error('Rate provenance missing or expired');
    for(const field of ['input_usd_per_million','cached_input_usd_per_million','output_usd_per_million'])
      if(!Number.isFinite(rate[field])||rate[field]<0) throw Error('Invalid token pricing');
    for(const field of ['max_input_tokens','max_output_tokens'])
      if(!Number.isSafeInteger(rate[field])||rate[field]<=0) throw Error('Verified model token bounds required');
    return rate;
  }
  const cny=usd=>{
    const n=Math.ceil(usd*policy.fx_cny_per_usd);
    if(!Number.isSafeInteger(n)||n<0) throw Error('Unsafe monetary amount');
    return n;
  };
  return {
    policy,
    pause:paused=>invoke('pause',{paused}),
    status(config) {
      const state=invoke('summary');
      let pricingError=null;
      try {rateFor(config||{});} catch(e) {pricingError=e.message;}
      const overrun=state.alerts.some(a=>a.kind==='reservation-overrun');
      return {...state,policy,pricing_error:pricingError,scope:'shared-host-ledger',
        ready:!pricingError&&!state.paused&&!overrun&&state.exposure_micro_cny<policy.stop_new_tasks_micro_cny};
    },
    reserve(config,body,taskId) {
      const rate=rateFor(config);
      const output=body.max_output_tokens??body.max_completion_tokens??body.max_tokens;
      if(body.model!==config.model||!Number.isSafeInteger(output)||output<=0||output>rate.max_output_tokens)
        throw Error('Unbounded output or model mismatch');
      // Only the text/image action protocol is priced. Tools/audio/background jobs
      // and arbitrary provider extensions need their own audited billing adapter.
      const allowed=config.api==='responses'
        ? ['model','store','max_output_tokens','reasoning','input','text']
        : ['model','store','max_completion_tokens','max_tokens','messages','response_format','reasoning_effort','temperature','enable_thinking'];
      if(Object.keys(body).some(k=>!allowed.includes(k))) throw Error('Unpriced request feature');
      const messages=config.api==='responses'?body.input:body.messages;
      const types=config.api==='responses'?['input_text','input_image']:['text','image_url'];
      if(!Array.isArray(messages)||messages.some(m=>!Array.isArray(m.content)||m.content.some(c=>!types.includes(c.type))))
        throw Error('Unpriced message content');
      if(!taskId) throw Error('Stable task identity required for paid dispatch');
      const maximum=cny(rate.max_input_tokens*Math.max(rate.input_usd_per_million,rate.cached_input_usd_per_million)
        +output*rate.output_usd_per_million);
      const id=crypto.randomUUID();
      const receipt=invoke('reserve',{request_id:id,task_id:taskId,maximum_micro_cny:maximum,
        identity:{provider:config.provider,model:config.model,request_sha256:crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex')}});
      return {id,maximum_micro_cny:maximum,remaining_ms:receipt.remaining_ms,
        settle(response) {
          const u=response?.usage;
          let charge=null;
          if(response?.failure_class==='not-dispatched-deadline') charge=0;
          else if(response.model_returned===config.model&&u&&Number.isSafeInteger(u.input_tokens)&&u.input_tokens>=0&&Number.isSafeInteger(u.output_tokens)&&u.output_tokens>=0) {
            const cached=u.cached_input_tokens;
            if(Number.isSafeInteger(cached)&&cached>=0&&cached<=u.input_tokens)
              charge=cny((u.input_tokens-cached)*rate.input_usd_per_million+cached*rate.cached_input_usd_per_million+u.output_tokens*rate.output_usd_per_million);
            else if(cached==null&&rate.input_usd_per_million===rate.cached_input_usd_per_million)
              charge=cny(u.input_tokens*rate.input_usd_per_million+u.output_tokens*rate.output_usd_per_million);
          }
          invoke('settle',{request_id:id,charge_micro_cny:charge});
          const mismatch=response.failure_class==='provider-model-identity-unverified';
          if(mismatch||['provider-budget','provider-auth'].includes(response.failure_class))
            invoke('pause',{paused:true,reason:mismatch?'provider-model-mismatch':response.failure_class});
          return {request_id:id,reserved_micro_cny:maximum,charge_micro_cny:charge};
        }};
    },
  };
}
