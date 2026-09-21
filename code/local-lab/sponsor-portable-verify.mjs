// Fresh-checkout engineering acceptance: no historical data, private paper or .venv path required.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readDeploymentProfile} from './sponsor-portable-config.mjs';

const code=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),o={python:'python3'};
for(let i=0;i<args.length;i++) {
  if(['--output','--python','--framework-profile'].includes(args[i])&&args[i+1]&&!args[i+1].startsWith('--'))o[args[i].slice(2)]=args[++i];
  else if(args[i]==='--with-artifacts')o.artifacts=true;
  else throw Error('Usage: node local-lab/sponsor-portable-verify.mjs --output NEW_DIRECTORY [--python PYTHON_EXECUTABLE] [--with-artifacts] [--framework-profile DEPLOYMENT_PROFILE.json]');
}
if(!o.output)throw Error('New private output directory required');
const dest=path.resolve(o.output);
// Deliberately refuses existing paths. No repair, overwrite or stale-green reuse.
fs.mkdirSync(dest,{mode:0o700});
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const list=dir=>fs.readdirSync(path.join(code,dir)).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>`${dir}/${f}`);
// These historical integration tests read downloaded source/generated inventories.
// Keep them explicit, executable on request and distinct from portable code tests.
const artifactTests=['benchmark-artifact-snapshot','llm-screening-simulation','outcome-blind-task-candidates','screening-ledger-template']
  .map(n=>`tests/contracts/${n}.test.mjs`);
function sources() {
  const all=[];
  const walk=dir=>{for(const e of fs.readdirSync(path.join(code,dir),{withFileTypes:true})) {
    const f=path.posix.join(dir,e.name);
    if(e.isDirectory())walk(f);
    else if(e.isFile()&&/\.(mjs|js|py|json|lock|html|css)$/.test(e.name))all.push({file:f,sha256:sha(fs.readFileSync(path.join(code,f)))});
  }};
  for(const dir of ['local-lab','src','config','scripts','tests/contracts'])walk(dir);
  for(const file of ['package.json','package-lock.json'])all.push({file,sha256:sha(fs.readFileSync(path.join(code,file)))});
  return all.sort((a,b)=>a.file.localeCompare(b.file));
}
const before=sources(),steps=[
  {id:'installed-node-dependencies',cmd:'npm',args:['ls','--depth=0']},
  {id:'active-design',cmd:process.execPath,args:['local-lab/validate-active-study.mjs']},
  {id:'local-node-and-browser',tests:true,cmd:process.execPath,args:['--test','--test-reporter=tap',...list('local-lab')]},
  {id:'source-only-contract-regression',tests:true,cmd:process.execPath,args:['--test','--test-reporter=tap',...list('tests/contracts').filter(f=>!artifactTests.includes(f))]},
  {id:'runtime-python',tests:true,cmd:o.python,args:['-m','unittest','discover','-s','local-lab','-p','test_runtime*.py','-v']},
  {id:'ata-input-projection',tests:true,cmd:o.python,args:['local-lab/ata-preparation-test.py']}
];
if(o.artifacts)steps.push({id:'historical-artifact-integration',tests:true,cmd:process.execPath,args:['--test','--test-reporter=tap',...artifactTests]});
if(o['framework-profile']) {
  const profile=readDeploymentProfile(path.resolve(o['framework-profile']),code).resolved;
  for(const [key,name] of [['agentlab','agentlab'],['browser_use','browser-use']])
    steps.push({id:`native-framework-${name}`,native:true,cmd:profile.python_environments[key].executable,
      args:['local-lab/framework-native-probe.py','--framework',name]});
}
const report={kind:'SPONSOR_PORTABLE_OFFLINE_VERIFICATION',started_at:new Date().toISOString(),
  source_files:before,source_tree_sha256:sha(JSON.stringify(before)),checks:[],
  historical_data_required:false,model_requests:0,benchmark_executions:0,confirmatory_authorized:false,
  artifact_integration:{requested:Boolean(o.artifacts),status:o.artifacts?'pending':'not-run',test_files:artifactTests,
    note:'Explicit historical-source integration group. Not-run is not passed; v1 inventory checks are not current scientific admission.'}};
// Avoid leaking inherited paid-provider credentials to an offline verification child.
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!(/^(CUA_|OPENAI_|PSS_|ANTHROPIC_|AZURE_|DEEPSEEK_|DASHSCOPE_|ARK_|GOOGLE_API_KEY|GEMINI_API_KEY)/.test(k)||/(API_KEY|ACCESS_TOKEN|SECRET_KEY)$/.test(k))));
env.PYTHONDONTWRITEBYTECODE='1';
env.ANONYMIZED_TELEMETRY='false';env.BROWSER_USE_VERSION_CHECK='false';
env.LITELLM_LOCAL_MODEL_COST_MAP='True';
for(const step of steps) {
  console.log(`Checking ${step.id} ...`);
  const start=Date.now(),r=spawnSync(step.cmd,step.args,{cwd:code,env,encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024});
  const raw=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(path.join(dest,`${step.id}.log`),raw,{mode:0o600,flag:'wx'});
  const count=kind=>{const m=raw.match(new RegExp(`^# ${kind} (\\d+)$`,'m'));return m?Number(m[1]):null;};
  const py=raw.match(/Ran (\d+) tests? in /)?.[1];
  const n=count('tests')??(py?Number(py):null),skipped=count('skipped')??(py?Number(raw.match(/OK \(skipped=(\d+)\)/)?.[1]||0):null);
  const passed=count('pass')??(py&&r.status===0?Number(py)-skipped:null);
  let nativeResult=null;
  if(step.native)try{nativeResult=JSON.parse(raw.split('\n').find(l=>l.startsWith('{"kind": "FRAMEWORK_NATIVE_COMPONENT_PROBE"')));}catch{}
  report.checks.push({id:step.id,passed:r.status===0&&(!step.tests||(n>0&&passed===n&&skipped===0))&&(!step.native||(nativeResult?.passed===true&&nativeResult?.benchmark_adapter_admitted===false)),exit_code:r.status,error_code:r.error?.code??null,
    ...(step.native?{native_component:nativeResult}:{}),
    tests:n,passed_tests:passed,skipped_tests:skipped,
    elapsed_ms:Date.now()-start,log_sha256:sha(raw)});
}
report.finished_at=new Date().toISOString();
if(o.artifacts)report.artifact_integration.status=report.checks.find(c=>c.id==='historical-artifact-integration')?.passed?'passed':'failed';
report.source_tree_unchanged=JSON.stringify(before)===JSON.stringify(sources());
report.passed=report.source_tree_unchanged&&report.checks.every(c=>c.passed);
report.scope='Offline engineering regression; synthetic fixtures are not official benchmark executions. Sponsor runtime, framework boundaries and reset/evaluator acceptance remain separate.';
fs.writeFileSync(path.join(dest,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600,flag:'wx'});
console.log(JSON.stringify({passed:report.passed,source_tree_unchanged:report.source_tree_unchanged,checks:report.checks,artifact_integration:report.artifact_integration,model_requests:0,benchmark_executions:0,confirmatory_authorized:false},null,2));
if(!report.passed)process.exitCode=2;
