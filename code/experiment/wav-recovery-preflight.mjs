import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {assertDisposableInstance,officialShoppingServicesReady} from './provisioning-contract.mjs';
const exec=promisify(execFile), code=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const store=path.join(code,'artifacts/local-runtime'), name='pss-wav-reset-preflight';
const old=JSON.parse(fs.readFileSync(path.join(store,'wav-reset-preflight-1789981738320.json')));
const docker=async args=>(await exec('docker',['--context','colima-webarena-x86',...args],
  {encoding:'utf8',timeout:60000,maxBuffer:1024*1024})).stdout.trim();
const inspect=async()=>JSON.parse(await docker(['inspect',name]))[0];
const own=async()=>assertDisposableInstance(await inspect(),old.run_id,old.expected_image.split('@')[1]);
const started=Date.now(), id=`wav-recovery-${started}`;
const report={kind:'ISOLATED_SERVICE_RECOVERY_DIAGNOSTIC',id,started_at:new Date().toISOString(),
  confirmatory_authorized:false,agent_executions:0,state_reset_verified:false,status:'running',polls:[],
  hypothesis:'Wait for official controller service health before one bounded homepage request; never flood PHP workers with timed-out warmups.'};
const save=()=>fs.writeFileSync(path.join(store,`${id}.json`),JSON.stringify(report,null,2)+'\n');
let startedByUs=false;
try {
  const c=await own();
  if(c.State.Running) throw Error('Refuse recovery: retained clone already running');
  report.container_id=c.Id; save();
  await docker(['start',name]); startedByUs=true;
  while(Date.now()-started<480000) {
    const p={at:new Date().toISOString()};
    try {
      const r=await fetch('http://127.0.0.1:17771/status',{signal:AbortSignal.timeout(15000)});
      const j=await r.json();
      p.http_status=r.status;p.success=j.success;p.services=j.details?.value?.services||{};
      p.services_ready=officialShoppingServicesReady(r.status,j);
    } catch(e) {p.error=e.name;}
    report.polls.push(p);save();
    if(p.services_ready) {report.services_ready=true;break;}
    await new Promise(r=>setTimeout(r,15000));
  }
  if(!report.services_ready) throw Error('Official service-health gate remains blocked');
  const begin=Date.now();
  const r=await fetch('http://127.0.0.1:17770/',{signal:AbortSignal.timeout(60000),redirect:'manual'});
  const body=await r.text();
  report.homepage={status:r.status,location:r.headers.get('location'),elapsed_ms:Date.now()-begin,bytes:Buffer.byteLength(body),
    successful:r.status===200 && body.includes('<html') && !body.includes('Fatal error')};
  report.status=report.homepage.successful?'component-recovered':'blocked';
} catch(e) {report.status='blocked';report.error=e.name+': '+e.message.slice(0,300);process.exitCode=2;}
finally {
  if(startedByUs) {try{await own();await docker(['stop','--time','40',name]);report.stopped=true;}catch{report.stopped=false;}}
  report.finished_at=new Date().toISOString();save();console.log(JSON.stringify(report));
}
