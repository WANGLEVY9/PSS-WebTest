import crypto from 'node:crypto';
import {resolveProvider,publicProvider,callProvider} from './provider.mjs';
export const ROUTING_POLICY='fixed-actor-postrun-aux-v1';
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');

// No task difficulty, evaluator, URL, other arm, timeout, or prior outcome can choose an actor.
export function actorRoute(config) {
  const {configuration_sha256:ignoredDigest,...declared}=config;
  const route={policy:ROUTING_POLICY,role:'benchmark_actor',selection:'fixed-before-run',
    provider:config.provider,model:config.model,provider_configuration_sha256:publicProvider(declared).configuration_sha256,
    fallback_allowed:false,auxiliary_feedback_allowed:false};
  return {...route,policy_sha256:sha(route)};
}
export function auditActorRouting(batch) {
  if(!batch.model_routing) return {status:'legacy-unrecorded',errors:[]};
  const expected=actorRoute(batch.provider_configuration),errors=[];
  if(JSON.stringify(batch.model_routing)!==JSON.stringify(expected)) errors.push('batch actor routing differs from declared provider configuration');
  for(const record of batch.records) for(const request of record.requests||[]) {
    if(JSON.stringify(request.model_routing)!==JSON.stringify(expected) || request.model_requested!==expected.model || request.provider!==expected.provider)
      errors.push(`${record.record_id}: action request changed fixed actor routing`);
  }
  return {status:errors.length?'invalid':'verified',errors};
}
export function auxiliaryProvider(env) {
  if(env.PSS_AUX_ENABLED!=='1') throw Error('Auxiliary model is disabled; explicit opt-in required');
  if(!['openai','openai-compatible'].includes(env.PSS_LOCAL_PROVIDER)) throw Error('Auxiliary route requires explicit OpenAI configuration');
  if(!env.PSS_AUX_MODEL) throw Error('Explicit auxiliary model ID required');
  return resolveProvider({...env,OPENAI_MODEL:env.PSS_AUX_MODEL,
    PSS_OPENAI_REASONING_EFFORT:env.PSS_AUX_REASONING_EFFORT||'low',PSS_LOCAL_MAX_OUTPUT_TOKENS:'512'});
}
const failures=['provider-timeout','provider-auth','provider-rate-limit','provider-service','provider-http','provider-network','provider-response-invalid','provider-output-incomplete','provider-refusal','model-output-contract','step-budget','agent-timeout','time-budget','provider-or-action-timeout','execution','reset','environment','evaluator','interrupted'];
const hypotheses=['provider_or_transport','runtime_or_environment','output_contract','budget_exhaustion','insufficient_evidence'];
const checks=['check_provider_telemetry','check_reset_and_evaluator','audit_action_schema','audit_budget_and_latency','inspect_authorized_replay'];
// Deliberately no free-text strings, screenshots, credentials, URLs, prompts, gold or agent outputs.
// This auxiliary model suggests an inspection queue; it cannot establish a causal failure label.
export function triageEnvelope(record) {
  if(!record.finished_at || ['running','pending'].includes(record.status)) throw Error('Post-run triage requires a terminal record');
  if(!record.failure_class) throw Error('Failure record required');
  return {schema:'postrun-metadata-only-v1',failure_signal:failures.includes(record.failure_class)?record.failure_class:'unclassified',
    action_count:record.actions?.length||0,request_count:record.requests?.length||0,
    requests:(record.requests||[]).map(r=>({
      failure_signal:failures.includes(r.failure_class)?r.failure_class:null,
      http_status:Number.isInteger(r.http_status) && r.http_status>=100 && r.http_status<=599?r.http_status:null,
      latency_ms:Number.isFinite(r.latency_ms)&&r.latency_ms>=0?r.latency_ms:null,
    }))};
}
export async function triageFailure(config,record,{fetchImpl=fetch}={}) {
  const evidence=triageEnvelope(record);
  const schema={type:'object',properties:{hypothesis:{type:'string',enum:hypotheses},next_check:{type:'string',enum:checks}},required:['hypothesis','next_check'],additionalProperties:false};
  const prompt='Suggest the next engineering inspection for this terminal run metadata. Signals are not proven causes. Do not conclude the agent lacks capability. With insufficient evidence choose insufficient_evidence. Return JSON only. '+JSON.stringify(evidence);
  const format={name:'postrun_triage',strict:true,schema};
  const body=config.api==='responses'?{model:config.model,store:false,max_output_tokens:512,
    ...(config.reasoning_effort?{reasoning:{effort:config.reasoning_effort}}:{}),
    input:[{role:'user',content:[{type:'input_text',text:prompt}]}],text:{format:{type:'json_schema',...format}}}:
    {model:config.model,store:false,max_completion_tokens:512,
      ...(config.reasoning_effort?{reasoning_effort:config.reasoning_effort}:{}),
      messages:[{role:'user',content:prompt}],response_format:{type:'json_schema',json_schema:format}};
  const response=await callProvider(config,body,{timeoutMs:15000,fetchImpl});
  const {output,...telemetry}=response;
  let annotation=null,failure_class=response.failure_class;
  if(!failure_class) {
    try {
      const parsed=JSON.parse(output);
      if(!parsed || Object.keys(parsed).sort().join(',')!=='hypothesis,next_check' || !hypotheses.includes(parsed.hypothesis)||!checks.includes(parsed.next_check)) throw Error('Invalid');
      annotation=parsed;
    } catch {failure_class='auxiliary-output-contract';}
  }
  return {kind:'PROVISIONAL_POSTRUN_TRIAGE',policy:ROUTING_POLICY,role:'auxiliary_diagnostic',
    provider_configuration:publicProvider(config),request_sha256:sha(body),evidence_sha256:sha(evidence),
    requires_human_review:true,changes_outcome:false,confirmatory_eligible:false,
    ...telemetry,failure_class,annotation};
}
