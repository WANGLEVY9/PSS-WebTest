import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {loadRuntimeEnv} from './runtime-env.mjs';
import {resolveProvider,publicProvider} from './provider.mjs';
import {currentExecutionGate,ADAPTER_CAPABILITIES} from './execution-gate.mjs';
import {officialShoppingServicesReady,parseDfKilobytes} from './provisioning-contract.mjs';
const code=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const store=path.join(code,'artifacts/local-runtime');
const read=file=>{try{return JSON.parse(fs.readFileSync(file));}catch{return null;}};
const checks=[];
const check=(id,passed,detail)=>checks.push({id,passed,detail});
let provider=null;
try {const c=resolveProvider(loadRuntimeEnv(),{requireKey:false});provider=publicProvider(c);check('provider-configuration',Boolean(c.apiKey),c.apiKey?'Configured, NOT live-verified':'Key missing; no model requests made');}
catch {check('provider-configuration',false,'Explicit provider/model/base configuration incomplete');}
// A healthy legacy Qwen configuration must not conceal missing sponsor credentials.
try {
  const sponsorEnv=loadRuntimeEnv({...process.env,PSS_LOCAL_ENV_FILE:process.env.PSS_LOCAL_ENV_FILE || path.join(code,'.env.openai')});
  const c=resolveProvider(sponsorEnv,{requireKey:false});
  check('openai-sponsor-configuration',c.provider.startsWith('openai') && Boolean(c.apiKey),
    'Isolated sponsor provider/model/key presence only; requires opt-in live smoke');
} catch {check('openai-sponsor-configuration',false,'Sponsor model/key not configured in isolated env file; template is prepared');}
check('node-runtime',Number(process.versions.node.split('.')[0])>=20,process.version);
check('chromium-installed',fs.existsSync(chromium.executablePath()),'Browser executable presence only; run sponsor-verify for launch tests');
const run=(cmd,args)=>execFileSync(cmd,args,{cwd:code,encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']}).trim();
try {run('npm',['ls','--depth=0']);check('node-dependencies',true,'Installed direct dependencies satisfy package.json');}
catch {check('node-dependencies',false,'Run npm ci; inspect version conflicts');}
for(const [id,relative] of [['wav','.venv-benchmark'],['vwa','.venv-vwa']]) {
  try {run('uv',['pip','check','--python',path.join(code,relative,'bin/python')]);check(`${id}-python-dependencies`,true,'uv pip check passed');}
  catch {check(`${id}-python-dependencies`,false,'Dependency check failed or environment/tool unavailable; do not silently upgrade official pins');}
}
const manifest=read(path.join(code,'config/benchmark-artifact-manifest.v1.0.json'));
for(const b of manifest?.mandatory_core||[]) {
  const name=b.id==='autonomous-tester-agent-benchmark'?'pinata':b.id;
  const target=path.join(code,'artifacts/benchmark-snapshots',name);
  try {
    const head=run('git',['-C',target,'rev-parse','HEAD']);
    const clean=run('git',['-C',target,'status','--porcelain','--untracked-files=no'])==='';
    check(`${b.id}-source-pin`,head===b.source_commit && clean,{expected:b.source_commit,actual:head,tracked_clean:clean});
  } catch {check(`${b.id}-source-pin`,false,'Pinned checkout unavailable');}
}
let infrastructure={probed:false};
if(process.argv.includes('--live-environment')) {
  infrastructure.probed=true;
  try {
    infrastructure.vm_available_bytes=parseDfKilobytes(run('colima',['ssh','--profile','webarena-x86','--','df','-Pk','/var/lib/docker']));
    const [c]=JSON.parse(run('docker',['--context','colima-webarena-x86','inspect','webarena-verified-shopping-x86']));
    infrastructure.shopping={container_id:c.Id,running:c.State.Running,image:c.Image,
      wildcard_port_bindings:Object.values(c.HostConfig.PortBindings||{}).flat().some(p=>['','0.0.0.0','::'].includes(p.HostIp))};
    check('shopping-loopback-isolation',!infrastructure.shopping.wildcard_port_bindings,'Wildcard-bound benchmark ports must be isolated before sponsor deployment; firewall reachability not tested');
    const res=await fetch('http://127.0.0.1:7771/status',{signal:AbortSignal.timeout(15000)}),body=await res.json();
    check('shopping-official-services',officialShoppingServicesReady(res.status,body),body.details?.value?.services||{});
  } catch {check('shopping-official-services',false,'Local Docker/service probe failed; no container changes made');}
}
const conformance=read(path.join(store,'benchmark-conformance.json'));
const verification=read(path.join(store,'sponsor-verification.json'));
const report={kind:'SPONSOR_READINESS_AUDIT',observed_at:new Date().toISOString(),
  host:{platform:os.platform(),architecture:os.arch(),node:process.version},
  checks,provider,infrastructure,offline_verification:verification,
  execution_gate:currentExecutionGate(),adapter_capabilities:ADAPTER_CAPABILITIES,
  benchmark_gates_snapshot:conformance?{observed_at:conformance.observed_at,benchmarks:conformance.benchmarks.map(b=>({id:b.id,admitted:b.admitted,open_gates:b.open_gates})),common_open_gates:conformance.common_open_gates}:null,
  only_api_key_missing:false,ready_for_benchmark:false,live_gpt_verified:false,
  confirmatory_authorized:false,model_requests:0,benchmark_executions:0,
  limitations:['Readiness report cannot authorize execution','OpenAI access/model vision support still require opt-in live synthetic smoke',
    'Official environment task/reset/evaluator gates and human study approvals are independent of model connectivity']};
report.source_sha256=crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex');
if(process.argv.includes('--write')) {
  fs.mkdirSync(store,{recursive:true});
  fs.writeFileSync(path.join(store,'sponsor-readiness.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
}
console.log(JSON.stringify(report,null,2));
// Intentionally nonzero until benchmark handoff is truly ready, even if all component tests pass.
if(!report.ready_for_benchmark)process.exitCode=2;
