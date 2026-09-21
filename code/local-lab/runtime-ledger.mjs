// Structured stdin bridge; arguments and database contain no credentials or prompts.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('./runtime_ledger_cli.py',import.meta.url));
export function requestLedger({database,opportunityId,leaseToken,capMicroUsd,python='python3'}) {
  const invoke=(command,payload)=>{
    const r=spawnSync(python,[script,command,database],{input:JSON.stringify(payload),encoding:'utf8',timeout:30000});
    if(r.status!==0) throw Error('Durable request ledger rejected operation: '+command);
    return JSON.parse(r.stdout);
  };
  return {
    reserve:(id,identity,maximumMicroUsd)=>invoke('reserve',{op:opportunityId,token:leaseToken,request_id:id,identity,maximum_micro_usd:maximumMicroUsd,cap_micro_usd:capMicroUsd}),
    settle:(id,response,charge)=>invoke('settle',{request_id:id,response,charge_micro_usd:charge}),
  };
}
