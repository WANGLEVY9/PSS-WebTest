// Local tariff preparation only: no model call, no overwrite, no ledger reset.
import fs from 'node:fs';
import path from 'node:path';
import {loadRuntimeEnv} from './runtime-env.mjs';
import {resolveProvider} from './provider.mjs';
const output=process.argv[2];
if(!output)throw Error('Usage: node experiment/prepare-qwen38-spend.mjs NEW_PRIVATE_POLICY.json');
const env=loadRuntimeEnv();
const c=resolveProvider({...env,PSS_LOCAL_PROVIDER:'aliyun',PSS_LOCAL_MODEL:'qwen3.8-max'});
if(!new URL(c.base_url).hostname.endsWith('.cn-beijing.maas.aliyuncs.com'))throw Error('Verified tariffs are Beijing workspace endpoint only');
const now=new Date();
if(now>=new Date('2026-09-24T00:00:00Z'))throw Error('Reverify published tariffs before renewing this dated policy');
const policy=JSON.parse(fs.readFileSync(new URL('../config/spend-policy.json',import.meta.url)));
policy.rates=[['max',12,1.5,36],['flash',0.8,0.1,2.7]].map(([kind,input,cached,output])=>({
  provider:'aliyun',model:`qwen3.8-${kind}`,base_url:c.base_url,currency:'CNY',
  input_cny_per_million:input,cached_input_cny_per_million:cached,output_cny_per_million:output,
  max_input_tokens:991808,max_output_tokens:2048,
  source:`https://help.aliyun.com/zh/model-studio/qwen3-8-${kind}`,
  verified_at:'2026-09-22T00:00:00Z',expires_at:'2026-09-24T00:00:00Z',
  note:'Published Beijing non-batch list price; no free quota assumed. Token estimate is not reconciled invoice.'
}));
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true,mode:0o700});
fs.writeFileSync(output,JSON.stringify(policy,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({policy:output,models:policy.rates.map(r=>r.model),network_requests:0}));
