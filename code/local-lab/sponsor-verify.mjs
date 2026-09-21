// Offline engineering regression only: no provider calls, SUT mutations or task execution.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const code=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=dir=>fs.readdirSync(path.join(code,dir)).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>`${dir}/${f}`);
const steps=[
  {id:'local-node-and-browser',cmd:process.execPath,args:['--test','--test-reporter=tap',...files('local-lab')]},
  {id:'study-contracts',cmd:process.execPath,args:['--test','--test-reporter=tap',...files('tests/contracts')]},
  {id:'ata-preparation',cmd:path.join(code,'.venv-benchmark/bin/python'),args:['local-lab/ata-preparation-test.py']},
  {id:'historical-ledger',cmd:process.execPath,args:['local-lab/validate-benchmark.mjs']},
  ...['study-design-contract','benchmark-artifact-manifest','long-cycle-experiment-plan'].map(name=>({id:name,cmd:process.execPath,args:[`scripts/validate-${name}.mjs`]})),
];
const report={kind:'SPONSOR_OFFLINE_VERIFICATION',started_at:new Date().toISOString(),model_requests:0,benchmark_executions:0,confirmatory_authorized:false,checks:[]};
report.source_files=fs.readdirSync(path.join(code,'local-lab')).filter(f=>f.endsWith('.mjs')).sort().map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(code,'local-lab',file))).digest('hex')}));
const dest=path.join(code,'artifacts/local-runtime',`sponsor-verify-${Date.now()}`);
fs.mkdirSync(dest,{recursive:true,mode:0o700});
for(const step of steps) {
  console.log(`Checking ${step.id} ...`);
  const start=Date.now(),r=spawnSync(step.cmd,step.args,{cwd:code,encoding:'utf8',timeout:60000,maxBuffer:16*1024*1024});
  const raw=(r.stdout||'')+(r.stderr||'');
  fs.writeFileSync(path.join(dest,`${step.id}.log`),raw,{mode:0o600});
  const stat=name=>{const m=raw.match(new RegExp(`^# ${name} (\\d+)$`,'m'));return m?Number(m[1]):null;};
  const pythonCount=raw.match(/Ran (\d+) tests? in /)?.[1];
  report.checks.push({id:step.id,passed:r.status===0,exit_code:r.status,error_code:r.error?.code||null,
    tests:stat('tests')??(pythonCount?Number(pythonCount):null),passed_tests:stat('pass')??(pythonCount && r.status===0?Number(pythonCount):null),failed_tests:stat('fail'),skipped_tests:stat('skipped'),
    elapsed_ms:Date.now()-start,log_sha256:crypto.createHash('sha256').update(raw).digest('hex')});
  fs.writeFileSync(path.join(dest,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
}
report.finished_at=new Date().toISOString();report.passed=report.checks.every(c=>c.passed);
fs.writeFileSync(path.join(dest,'report.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
fs.writeFileSync(path.join(code,'artifacts/local-runtime/sponsor-verification.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=2;
