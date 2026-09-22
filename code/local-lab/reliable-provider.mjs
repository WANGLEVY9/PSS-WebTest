import crypto from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {callProvider} from './provider.mjs';
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
export const RETRY_PROTOCOL='single-owner-transport-retry-v1';
export function costMicroUsd(usage,price) {
  if(!usage||!price) return null;
  const {input_tokens:i,output_tokens:o,cached_input_tokens:c}=usage;
  if(!Number.isSafeInteger(i)||i<0||!Number.isSafeInteger(o)||o<0) return null;
  const rates=[price.input_usd_per_million,price.cached_input_usd_per_million,price.output_usd_per_million];
  if(rates.some(x=>!Number.isFinite(x)||x<0)) throw Error('Explicit nonnegative rate card required');
  if(c===null||c===undefined) {if(rates[0]!==rates[1])return null;}
  else if(!Number.isSafeInteger(c)||c<0||c>i) throw Error('Invalid cached token usage');
  // Reasoning tokens are a subset of output tokens: never charge them twice.
  const cached=c??0;
  return Math.ceil((i-cached)*rates[0]+cached*rates[1]+o*rates[2]);
}
export async function accountedProvider(config,body,{ledger,price=null,reservationMicroUsd,
  maxAttempts=1,deadlineMs,requestTimeoutMs=45000,fetchImpl=fetch,budgetGuard,taskId,
  sleep=ms=>new Promise(r=>setTimeout(r,ms)),random=Math.random,now=()=>performance.now()}={}) {
  if(!ledger||!Number.isSafeInteger(reservationMicroUsd)||reservationMicroUsd<0) throw Error('Durable ledger and cost reservation required');
  if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3||!Number.isFinite(deadlineMs)||deadlineMs<=0||!Number.isInteger(requestTimeoutMs)||requestTimeoutMs<1) throw Error('Invalid bounded retry policy');
  if(body.model!==config.model)throw Error('Actor model cannot change');
  if(price && (price.model!==config.model||price.provider!==config.provider||!price.source||!price.effective_at))throw Error('Rate card must bind provider/model and provenance');
  if(price) costMicroUsd({input_tokens:0,output_tokens:0,cached_input_tokens:0},price);
  const start=now(),attempts=[];
  for(let attempt=1;attempt<=maxAttempts;attempt++) {
    const remaining=deadlineMs-(now()-start);
    if(remaining<1) break;
    const id=crypto.randomUUID();
    await ledger.reserve(id,{provider:config.provider,model:config.model,role:'benchmark_actor',request_sha256:hash(body),
      price_sha256:price?hash(price):null,retry_protocol:RETRY_PROTOCOL,attempt},reservationMicroUsd);
    // Reservation time also consumes the wall-clock budget.
    const left=deadlineMs-(now()-start);
    const response=left<1?{failure_class:'not-dispatched-deadline',usage:null,output:null}:
      await callProvider(config,body,{timeoutMs:Math.max(1,Math.floor(Math.min(requestTimeoutMs,left))),fetchImpl,budgetGuard,taskId});
    if(!response.failure_class && response.model_returned!==config.model && !(config.approved_model_returned_aliases||[]).includes(response.model_returned)) response.failure_class='provider-model-identity-unverified';
    const {output,...telemetry}=response;
    let charge=null;
    try {charge=response.failure_class==='not-dispatched-deadline'?0:costMicroUsd(response.usage,price);}
    catch {telemetry.accounting_error='invalid-provider-usage';}
    // Even malformed usage is settled as unknown, preserving the reservation and response trace.
    await ledger.settle(id,telemetry,charge);
    attempts.push({request_id:id,...telemetry,charge_micro_usd:charge});
    // Network/timeout delivery is ambiguous; never automatically replay it.
    // Authentication, malformed output and refusal are not transient transport errors.
    if(!['provider-rate-limit','provider-service'].includes(response.failure_class)||attempt===maxAttempts)
      return {...response,...(response.failure_class?{output:null}:{}),attempts,retry_protocol:RETRY_PROTOCOL};
    const delay=Math.max(response.retry_after_ms??0,Math.floor(Math.min(4000,250*2**(attempt-1))*(0.5+random())));
    if(now()-start+delay>=deadlineMs) return {...response,attempts,retry_protocol:RETRY_PROTOCOL};
    await sleep(delay);
  }
  return {failure_class:'provider-timeout',usage:null,output:null,attempts,retry_protocol:RETRY_PROTOCOL};
}
