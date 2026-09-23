import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {probeShoppingHttp} from './environment-probe.mjs';
const code=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const expected=JSON.parse(fs.readFileSync(path.join(code,'config/benchmark-artifact-manifest.v1.0.json')))
  .mandatory_core.find(b=>b.id==='webarena-verified').environment.candidate_image.reference;
const config=JSON.parse(fs.readFileSync(path.join(code,'experiment/benchmark-config.json')));
const site=new URL(config.environments.__SHOPPING__.urls[0]);
if(!['localhost','127.0.0.1'].includes(site.hostname) || site.protocol!=='http:' || site.port!=='7770' || site.username || site.password)
  throw Error('This local probe requires a loopback Shopping URL on port 7770');
const docker=args=>execFileSync('docker',['--context','colima-webarena-x86',...args],{encoding:'utf8',timeout:20000,stdio:['ignore','pipe','pipe']}).trim();
const safe={observed_at:new Date().toISOString(),benchmark_id:'webarena-verified',expected_image:expected,
  image_matches:false,architecture_compatible:false,ready:false,study_execution_allowed:false,
  scope:'Local environment readiness only; not task/reset/evaluator admission'};
try {
  const [container]=JSON.parse(docker(['inspect','webarena-verified-shopping-x86']));
  safe.container_id=container.Id;safe.image_matches=container.Image===expected.split('@')[1];
  const host=docker(['info','--format','{{.Architecture}}']);
  const arch=docker(['image','inspect',expected,'--format','{{.Architecture}}']);
  safe.architecture_compatible=['amd64','x86_64'].includes(host) && arch==='amd64';
  if(safe.image_matches && safe.architecture_compatible && container.State.Running)
    Object.assign(safe,await probeShoppingHttp({site:new URL('/',site).href}));
  safe.ready=safe.image_matches && safe.architecture_compatible && safe.controller_success===true && safe.navigation_verified===true;
} catch {safe.failure_class='environment-inspection';}
// Evidence freshness is measured after all checks, not before a slow warmup.
safe.observed_at=new Date().toISOString();
const dest=path.join(code,'artifacts/local-runtime');fs.mkdirSync(dest,{recursive:true});
fs.writeFileSync(path.join(dest,'benchmark-readiness.json'),JSON.stringify(safe,null,2)+'\n');
console.log(JSON.stringify(safe,null,2));
if(!safe.ready)process.exitCode=2;
