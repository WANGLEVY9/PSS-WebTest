import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {nativeInitializerExited,assertDisposableInstance} from './provisioning-contract.mjs';
const code=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const context='colima-webarena-x86', container='pss-wav-reset-preflight';
const primary='webarena-verified-shopping-x86', site='http://127.0.0.1:17770/';
const expected=JSON.parse(fs.readFileSync(path.join(code,'config/benchmark-artifact-manifest.v1.0.json')))
  .mandatory_core.find(b=>b.id==='webarena-verified').environment.candidate_image.reference;
const runId=`wav-reset-preflight-${Date.now()}`;
const file=path.join(code,'artifacts/local-runtime',`${runId}.json`);
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
const docker=args=>execFileSync('docker',['--context',context,...args],{encoding:'utf8',timeout:180000,maxBuffer:64*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
const inspect=name=>JSON.parse(docker(['inspect',name]))[0];
const sql=(name,query)=>docker(['exec',name,'mysql','-N','-B','-umagentouser','-pMyPassword','magentodb','-e',query]);
const tables=['review','review_detail','review_store','rating_option_vote','rating_option_vote_aggregated','review_entity_summary'];
const fingerprint=name=>{
  // Hash in-container: never buffer/export hundreds of MB of fixture rows.
  // pipefail is essential: an unsuccessful dump must not hash as an empty success.
  const output=docker(['exec',name,'bash','-o','pipefail','-c',
    'mysqldump -umagentouser -pMyPassword --no-create-info --skip-comments --compact --skip-add-locks --skip-disable-keys --skip-extended-insert --order-by-primary --skip-lock-tables magentodb '+tables.join(' ')+' | sha256sum']);
  const digest=output.split(/\s+/)[0];
  if(!/^[a-f0-9]{64}$/.test(digest)) throw Error('Invalid fixture digest output');
  return digest;
};
const report={kind:'ISOLATED_RESET_ENGINEERING_PREFLIGHT',run_id:runId,started_at:new Date().toISOString(),
  status:'running',confirmatory_authorized:false,container,primary_container:primary,expected_image:expected,
  scope:'Review-related table contents only; not full task-set or benchmark admission',tables,
  source_sha256:sha(fs.readFileSync(fileURLToPath(import.meta.url))),
  events:[],cycles:[],state_reset_verified:false,primary_unchanged:null};
const save=()=>fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
const event=phase=>{report.events.push({phase,at:new Date().toISOString()});save();};
function ownsContainer() {
  const c=inspect(container);
  return assertDisposableInstance(c,runId,expected.split('@')[1]);
}
async function create() {
  event('create-start');
  docker(['run','-d','--name',container,'--label',`pss.preflight-run=${runId}`,
    '--platform','linux/amd64','-p','127.0.0.1:17770:80','-p','127.0.0.1:17771:8877',
    '-e',`WA_ENV_CTRL_EXTERNAL_SITE_URL=${site}`,expected]);
  ownsContainer();
  event('waiting-for-native-init');
  let ready=false;
  for(let i=0;i<72;i++) {
    try {
      // This official image starts env-ctrl-init itself. Do not race it with a second init.
      let state, status=0;
      try { state=docker(['exec',container,'supervisorctl','status','env-ctrl-init']); }
      catch(e) {
        // supervisorctl returns 3 for an EXITED one-shot program, including success.
        // Preserve the output and still require EXITED plus DB/HTTP evidence.
        if(e.status!==3) throw e;
        state=String(e.stdout||''); status=e.status;
      }
      if(nativeInitializerExited(status,state) && sql(container,'SELECT 1')==='1') {ready=true;break;}
    } catch {}
    await new Promise(r=>setTimeout(r,5000));
  }
  if(!ready) throw Error('Native initializer did not finish within provisioning window');
  event('native-init-exited');
  // An exited initializer alone is insufficient: require DB configuration AND serving site.
  const urls=sql(container,"SELECT value FROM core_config_data WHERE path IN ('web/unsecure/base_url','web/secure/base_url') ORDER BY path").split('\n');
  if(urls.length!==2 || urls.some(x=>x!==site)) throw Error('Isolated site base URL mismatch');
  let response=null;
  for(let attempt=0;attempt<6;attempt++) {
    try {
      const r=await fetch(site,{signal:AbortSignal.timeout(20000)});
      if(r.ok && new URL(r.url).origin===new URL(site).origin) {response=r;break;}
    } catch {}
    await new Promise(r=>setTimeout(r,5000));
  }
  if(!response) throw Error('Isolated site HTTP/origin gate failed after bounded warmup');
  event('site-ready');
  return {container_id:ownsContainer().Id,site_status:response.status,base_urls_match:true,digest:fingerprint(container)};
}
try {
  if(docker(['ps','-a','--filter',`name=^/${container}$`,'--format','{{.Names}}']))
    throw Error('Dedicated preflight container already exists; inspect it before any rerun');
  const primaryInfo=inspect(primary);
  report.primary_container_id=primaryInfo.Id;
  report.primary_before=fingerprint(primary);
  fs.copyFileSync(fileURLToPath(import.meta.url),file.replace(/\.json$/,'.mjs'));
  fs.copyFileSync(path.join(code,'local-lab/provisioning-contract.mjs'),file.replace(/\.json$/,'.contract.mjs'));
  save();
  const first=await create();
  report.initial=first; save();
  for(let cycle=1;cycle<=3;cycle++) {
    ownsContainer();
    const marker=`PSS_RESET_SENTINEL_${cycle}_${runId}`;
    const detailId=sql(container,'SELECT MIN(detail_id) FROM review_detail');
    if(!/^\d+$/.test(detailId)) throw Error('No fixture review detail to probe');
    sql(container,`UPDATE review_detail SET title='${marker}' WHERE detail_id=${detailId}`);
    const changed=fingerprint(container);
    if(changed===first.digest || sql(container,`SELECT title FROM review_detail WHERE detail_id=${detailId}`)!==marker)
      throw Error('Controlled local fixture mutation was not observed');
    const oldId=ownsContainer().Id;
    docker(['rm','-f',container]); // Only this run's disposable, mount-free container.
    const restored=await create();
    const row={cycle,old_container_id:oldId,...restored,mutation_digest:changed,
      mutation_detected:changed!==first.digest,restored:restored.digest===first.digest,
      primary_unchanged:inspect(primary).Id===report.primary_container_id && fingerprint(primary)===report.primary_before};
    report.cycles.push(row); save();
    if(!row.restored || !row.primary_unchanged) throw Error('State restoration or primary isolation check failed');
  }
  report.primary_unchanged=true;
  report.state_reset_verified=report.cycles.length===3;
  report.status='completed';
} catch(e) {
  report.status='blocked'; report.error=String(e.message).replaceAll('MyPassword','[fixture-password]').slice(0,1200);
  process.exitCode=2;
} finally {
  // Retain final disposable container for inspection, but stop its resource use.
  try { ownsContainer(); docker(['stop',container]); report.final_container_stopped=true; } catch { report.final_container_stopped=false; }
  report.finished_at=new Date().toISOString(); save();
  console.log(JSON.stringify(report,null,2));
}
