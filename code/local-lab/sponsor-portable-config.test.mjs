import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateDeploymentProfile,readDeploymentProfile,resolveDeploymentPath,parseExactPins,indexInstalledDistributions,compareExactPins,inspectContainer,deploymentSummary} from './sponsor-portable-config.mjs';

const template=()=>({schema:'pss-sponsor-deployment-v1',purpose:'sponsor-native-linux',docker_context:'default',
  sources:{wav:'sources/wav',vwa:'sources/vwa',ata:'sources/ata'},
  python_environments:Object.fromEntries(['wav','vwa','agentlab','browser_use'].map(k=>[k,{executable:`envs/${k}/bin/python`,lock_file:null}])),
  storage:{docker_filesystem_path:null,required_free_bytes:null,ledger_path:'artifacts/private'},containers:[]});

test('deployment profile cannot smuggle credentials or an authorization flag',()=>{
  assert.deepEqual(validateDeploymentProfile(template()),template());
  for(const field of ['api_key','confirmatory_authorized','shell_command','expected_results'])
    assert.throws(()=>validateDeploymentProfile({...template(),[field]:'private'}),/unknown field/);
  const p=template();p.python_environments.agentlab.api_key='private';assert.throws(()=>validateDeploymentProfile(p));
});
test('explicit Docker context, positive storage reserve and pinned unique images are required',()=>{
  for(const value of ['',null,'--host=secret'])assert.throws(()=>validateDeploymentProfile({...template(),docker_context:value}));
  for(const value of [0,-1,Infinity,'1000'])assert.throws(()=>validateDeploymentProfile({...template(),storage:{...template().storage,required_free_bytes:value}}));
  const c={name:'fixture',benchmark:'wav',expected_image_digest:'sha256:'+'a'.repeat(64)};
  assert.doesNotThrow(()=>validateDeploymentProfile({...template(),containers:[c]}));
  assert.throws(()=>validateDeploymentProfile({...template(),containers:[c,c]}));
  assert.throws(()=>validateDeploymentProfile({...template(),containers:[{...c,expected_image_digest:'latest'}]}));
});
test('paths relocate against code root, never the developer home or caller cwd',()=>{
  assert.equal(resolveDeploymentPath('/srv/pss/code','../third_party/env/bin/python'),'/srv/pss/third_party/env/bin/python');
  assert.equal(resolveDeploymentPath('/srv/pss/code','/opt/venv/bin/python'),'/opt/venv/bin/python');
  for(const p of ['~/.venv','${HOME}/venv','bad\npath'])assert.throws(()=>resolveDeploymentPath('/srv/pss/code',p));
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pss-profile-'));
  try {
    const file=path.join(dir,'profile.json');fs.writeFileSync(file,JSON.stringify(template()));
    const r=readDeploymentProfile(file,'/srv/pss/code');
    assert.equal(r.resolved.sources.wav,'/srv/pss/code/sources/wav');assert.equal(r.raw.sources.wav,'sources/wav');
    assert.equal(r.resolved.storage.docker_filesystem_path,null);
  }finally{fs.rmSync(dir,{recursive:true});}
});
test('dependency checks compare every exact pin, not just the top-level framework version',()=>{
  const p=parseExactPins('# fixture\nAgentLab==0.4.2\nbrowsergym_core==0.14.2\n');
  assert.deepEqual(compareExactPins(p,{'agentlab':'0.4.2','browsergym-core':'0.14.2'}),[]);
  assert.deepEqual(compareExactPins(p,{agentlab:'0.4.2'}),[{name:'browsergym-core',expected:'0.14.2',actual:null,reason:'missing'}]);
  for(const lock of ['','agentlab>=0.4','agentlab @ https://example.org/a.whl','agentlab==0.4; python_version>="3.11"','a_b==1\na-b==2'])assert.throws(()=>parseExactPins(lock));
});
test('complete lock comparison reports every extra distribution, including installer tooling',()=>{
  const pins=parseExactPins('browser-use==0.13.10\n');
  assert.deepEqual(compareExactPins(pins,{'browser-use':'0.13.10',greenlet:'3.0.3',playwright:'1.44.0',pyee:'11.1.0',pip:'25.0'}),[
    {name:'greenlet',expected:null,actual:'3.0.3',reason:'unlocked'},
    {name:'pip',expected:null,actual:'25.0',reason:'unlocked'},
    {name:'playwright',expected:null,actual:'1.44.0',reason:'unlocked'},
    {name:'pyee',expected:null,actual:'11.1.0',reason:'unlocked'}
  ]);
});
test('version mismatch, missing package and unlocked replacement remain distinct',()=>{
  assert.deepEqual(compareExactPins({a:'1',b:'1'},{a:'2',c:'1'}),[
    {name:'a',expected:'1',actual:'2',reason:'version-mismatch'},
    {name:'b',expected:'1',actual:null,reason:'missing'},
    {name:'c',expected:null,actual:'1',reason:'unlocked'}
  ]);
});
test('distribution normalization cannot hide duplicate metadata records',()=>{
  const inventory=indexInstalledDistributions([['Browser_Use','0.13.10'],['Pillow','12.3.0']]);
  assert.deepEqual(compareExactPins({'browser-use':'0.13.10',pillow:'12.3.0'},inventory),[]);
  for(const duplicate of [[['a_b','1'],['A-b','1']],[['a','1'],['a','2']]])
    assert.throws(()=>indexInstalledDistributions(duplicate),/Duplicate/);
  assert.throws(()=>compareExactPins({'a-b':'1'},{a_b:'1','a-b':'1'}),/Duplicate/);
});
test('journaled actuator lock is the complete local Browser Use dependency declaration',()=>{
  const lock=name=>parseExactPins(fs.readFileSync(fileURLToPath(new URL(`../config/frameworks/${name}`,import.meta.url)),'utf8'));
  const old=lock('h-browser-use.lock'),current=lock('h-browser-use-journaled-actuator.lock');
  assert.deepEqual(compareExactPins(current,current),[]);
  const differences=compareExactPins(old,current);
  assert.deepEqual(differences.map(x=>x.name),['greenlet','playwright','pyee']);
  assert.ok(differences.every(x=>x.reason==='unlocked'));
});
test('container inspection exposes no env secrets and rejects wildcard or host networking',()=>{
  const image='sha256:'+'a'.repeat(64),info={Image:image,State:{Running:true},Config:{Env:['API_KEY=DO_NOT_EXPORT']},HostConfig:{NetworkMode:'bridge',PortBindings:{'80/tcp':[{HostIp:'127.0.0.1'}]}}};
  assert.equal(inspectContainer(info,image).loopback_only,true);assert.doesNotMatch(JSON.stringify(inspectContainer(info,image)),/DO_NOT_EXPORT/);
  assert.equal(inspectContainer(info,'sha256:'+'b'.repeat(64)).image_matches,false);
  for(const HostIp of ['','0.0.0.0','::','192.168.1.2'])assert.equal(inspectContainer({...info,HostConfig:{PortBindings:{'80/tcp':[{HostIp}]}}},image).loopback_only,false);
  assert.equal(inspectContainer({...info,HostConfig:{NetworkMode:'host'}},image).loopback_only,false);
});
test('green deployment checks can never become scientific admission',()=>{
  assert.equal(deploymentSummary([]).engineering_preflight_passed,false);
  const green=deploymentSummary([{id:'test',status:'passed'}]);
  assert.equal(green.engineering_preflight_passed,true);assert.equal(green.confirmatory_authorized,false);assert.equal(green.benchmark_executions,0);
  const unknown=deploymentSummary([{id:'reset',status:'unverified'}]);assert.equal(unknown.engineering_preflight_passed,false);assert.deepEqual(unknown.unverified_checks,['reset']);
});
test('doctor rejects secret-bearing input without echoing it or invoking any probes',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pss-profile-reject-'));
  try {
    const file=path.join(dir,'bad.json');fs.writeFileSync(file,JSON.stringify({...template(),api_key:'VERY_PRIVATE_SENTINEL'}));
    const r=spawnSync(process.execPath,[fileURLToPath(new URL('./sponsor-portable-doctor.mjs',import.meta.url)),'--profile',file],{encoding:'utf8'});
    assert.equal(r.status,2);assert.equal(r.stdout,'');assert.match(r.stderr,/No commands executed/);assert.doesNotMatch(r.stderr,/VERY_PRIVATE/);
  }finally{fs.rmSync(dir,{recursive:true});}
});
