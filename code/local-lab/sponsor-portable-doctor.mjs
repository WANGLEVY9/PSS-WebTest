// Read-only, no API requests, no source pulls, no reset and no container lifecycle actions.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readDeploymentProfile,parseExactPins,compareExactPins,inspectContainer,deploymentSummary} from './sponsor-portable-config.mjs';

const code=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const args=process.argv.slice(2),options={};
for(let i=0;i<args.length;i++) {
  if(['--profile','--output'].includes(args[i])&&args[i+1]&&!args[i+1].startsWith('--'))options[args[i].slice(2)]=args[++i];
  else if(args[i]==='--live-docker') options.live=true;
  else throw Error('Usage: node local-lab/sponsor-portable-doctor.mjs --profile FILE [--live-docker] [--output NEW_FILE]');
}
if(!options.profile)throw Error('Explicit deployment profile required; see config/sponsor-deployment.example.json');
// Validate before invoking anything, and never echo profile/exception contents (may be secrets).
let loaded;
try {loaded=readDeploymentProfile(path.resolve(options.profile),code);}
catch {console.error('Invalid deployment profile; use the documented schema. No commands executed.');process.exit(2);}
const p=loaded.resolved,checks=[];
const add=(id,status,detail)=>checks.push({id,status,detail});
const check=(id,ok,detail)=>add(id,ok?'passed':'failed',detail);
// Do not pass model credentials, launch switches, DOCKER_HOST or PYTHONPATH to probes.
const probeEnv=Object.fromEntries(['PATH','HOME','USER','TMPDIR','SYSTEMROOT','DOCKER_CONFIG','SSH_AUTH_SOCK'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
Object.assign(probeEnv,{LANG:'C.UTF-8',PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1',GIT_TERMINAL_PROMPT:'0'});
const run=(command,argv)=>{
  const r=spawnSync(command,argv,{cwd:code,encoding:'utf8',env:probeEnv,timeout:15000,maxBuffer:4*1024*1024});
  if(r.status!==0) throw Error('Probe failed');
  return r.stdout.trim();
};
const attempt=(id,fn)=>{try{fn();}catch{add(id,'failed','Probe unavailable or invalid; no raw process output retained');}};
const report={kind:'SPONSOR_PORTABLE_DEPLOYMENT_AUDIT',observed_at:new Date().toISOString(),
  purpose:p.purpose,profile_sha256:hash(JSON.stringify(loaded.raw)),
  host:{platform:os.platform(),architecture:os.arch(),node:process.version},checks};
check('node-runtime',Number(process.versions.node.split('.')[0])>=20,'Node >=20; exact runtime is recorded');
check('host-target',p.purpose==='local-diagnostic'||(os.platform()==='linux'&&os.arch()==='x64'),
  p.purpose==='local-diagnostic'?'Local diagnostic host; not native sponsor performance evidence':'Sponsor target is native Linux x86_64; Docker daemon also checked separately');
attempt('active-design',()=>{
  const pointer=JSON.parse(fs.readFileSync(path.join(code,'config/active-study-design.json')));
  if(!/^study-design-contract\.v[0-9.]+\.json$/.test(pointer.active_contract))throw Error('Invalid pointer');
  const raw=fs.readFileSync(path.join(code,'config',pointer.active_contract));
  const d=JSON.parse(raw),n=d.benchmarks.reduce((a,b)=>a+b.selected_tasks,0);
  const rounds=d.rounds.discovery.length+d.rounds.validation.length;
  const configs=d.models.length*d.agent_configurations_per_model.length+1;
  report.design={protocol_id:d.protocol_id,source_sha256:hash(raw),tasks:n,configurations:configs,rounds,scheduled_opportunities:n*configs*rounds};
  check('active-design',n===d.scale.tasks&&n*configs*rounds===d.scale.scheduled_opportunities&&d.new_execution_authorized===false,'Pointer and arithmetic only; full contract validation remains a separate test');
});
attempt('node-dependencies',()=>{run('npm',['ls','--depth=0','--json']);add('node-dependencies','passed','Installed direct dependencies satisfy package.json');});
try {
  const {chromium}=await import('playwright');
  check('chromium-installed',fs.existsSync(chromium.executablePath()),'Presence only; browser-launch and action calibration require offline regression');
}catch{add('chromium-installed','failed','Install locked Node dependencies and Chromium; no installation attempted');}
const sourceIds={wav:'webarena-verified',vwa:'visualwebarena',ata:'autonomous-tester-agent-benchmark'};
attempt('official-source-manifest',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(code,'config/benchmark-artifact-manifest.v1.0.json')));
  add('official-source-manifest','passed','Historical manifest used ONLY for source commits, never task counts or execution authority');
  for(const [name,id] of Object.entries(sourceIds))attempt(`${name}-source`,()=>{
    const expected=manifest.mandatory_core.find(b=>b.id===id)?.source_commit;
    const head=run('git',['-C',p.sources[name],'rev-parse','HEAD']);
    const status=run('git',['-C',p.sources[name],'status','--porcelain','--untracked-files=normal']);
    check(`${name}-source`,head===expected&&!status,{expected,actual:head,worktree_clean:status===''});
  });
});
for(const [name,e] of Object.entries(p.python_environments)) {
  attempt(`${name}-python`,()=>{
    const script='import json,sys,importlib.metadata as m,re; print(json.dumps({"python":sys.version.split()[0],"packages":{re.sub(r"[-_.]+","-",d.metadata["Name"].lower()):d.version for d in m.distributions() if d.metadata["Name"]}}))';
    const installed=JSON.parse(run(e.executable,['-I','-c',script]));
    add(`${name}-python`,'passed',{python:installed.python,installed_distributions:Object.keys(installed.packages).length});
    if(e.lock_file===null) {add(`${name}-pins`,'unverified','No exact dependency lock bound; installing successfully does not establish replication');return;}
    const raw=fs.readFileSync(e.lock_file,'utf8'),pins=parseExactPins(raw),mismatches=compareExactPins(pins,installed.packages);
    check(`${name}-pins`,mismatches.length===0,{lock_sha256:hash(raw),checked:Object.keys(pins).length,mismatches});
  });
  attempt(`${name}-dependency-consistency`,()=>{run('uv',['--no-cache','pip','check','--python',e.executable]);add(`${name}-dependency-consistency`,'passed','uv pip check (no persistent cache); not a module-inference smoke');});
}
attempt('ledger-directory',()=>{
  const stat=fs.statfsSync(p.storage.ledger_path,{bigint:true});
  // Known NFS/CIFS/SMB filesystems cannot safely host this single-host WAL ledger.
  const network=[0x6969n,0xff534d42n,0xfe534d42n,0x517bn].includes(stat.type);
  check('ledger-directory',!network,{available_bytes:String(stat.bavail*stat.bsize),known_network_filesystem:network,
    limitation:'Other remote/FUSE storage may not be detected; operator must verify local disk'});
});
if(!options.live) add('docker-runtime','unverified','Not probed; --live-docker permits bounded read-only inspect/info calls, never reset');
else attempt('docker-runtime',()=>{
  const prefix=['--context',p.docker_context];
  const daemon=JSON.parse(run('docker',[...prefix,'info','--format','{{json .}}']));
  const [context]=JSON.parse(run('docker',['context','inspect',p.docker_context]));
  check('docker-runtime',daemon.OSType==='linux'&&['x86_64','amd64'].includes(daemon.Architecture),{os:daemon.OSType,architecture:daemon.Architecture,server_version:daemon.ServerVersion});
  // Host fs.statfs is valid only for a local native daemon's exact storage root.
  const local=p.purpose==='sponsor-native-linux'&&os.platform()==='linux'&&os.arch()==='x64'&&context.Endpoints?.docker?.Host?.startsWith('unix://');
  if(!local||!p.storage.docker_filesystem_path||!p.storage.required_free_bytes||p.storage.docker_filesystem_path!==daemon.DockerRootDir)
    add('docker-storage','unverified','Require native-local daemon, exact DockerRootDir and measured provisioning reserve; never substitute Mac host free disk for VM capacity');
  else attempt('docker-storage',()=>{
    const s=fs.statfsSync(p.storage.docker_filesystem_path,{bigint:true}),free=s.bavail*s.bsize;
    check('docker-storage',free>=BigInt(p.storage.required_free_bytes),{available_bytes:String(free),required_bytes:p.storage.required_free_bytes,scope:'Operator-specified engineering reserve, not a benchmark admission proof'});
  });
  if(!p.containers.length)add('fixture-inventory','unverified','No explicit container inventory; no inference from unrelated containers');
  for(const c of p.containers)attempt(`fixture-${c.benchmark}-${c.name}`,()=>{
    const [info]=JSON.parse(run('docker',[...prefix,'inspect',c.name]));
    const facts=inspectContainer(info,c.expected_image_digest);
    check(`fixture-${c.benchmark}-${c.name}`,facts.running&&facts.image_matches&&facts.loopback_only&&['healthy','not-declared'].includes(facts.health_status),facts);
  });
});
report.summary=deploymentSummary(checks);
report.remaining_scientific_acceptance=[
  'Freeze prospective sponsor budgets and exact model/framework bindings before comparative runs; previous cloud data is not required for a new isolated campaign',
  'Verify official per-task fixture dependencies, reset/isolation, positive and negative evaluator controls on each benchmark',
  'Audit actual AgentLab and restricted Browser Use observations/actions against the manuscript; custom PSS diagnostic runner is not either framework',
  'Freeze outcome-blind eligible official IDs and independent human script-preparation evidence',
  'Verify all framework requests enter the accounting ledger, including internal retries; bind traces/records to the schedule',
  'Seal a separately reviewed campaign admission; this doctor cannot authorize collection'
];
if(options.output)fs.writeFileSync(path.resolve(options.output),JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify(report,null,2));
if(!report.summary.engineering_preflight_passed)process.exitCode=2;
