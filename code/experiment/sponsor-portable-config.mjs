// Deployment inputs, NOT scientific admission or permission to run tasks.
import fs from 'node:fs';
import path from 'node:path';

const must=(ok,message)=>{if(!ok)throw Error(message);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=x=>typeof x==='string'&&x.length>0&&!/[\r\n\0]/.test(x);
const keys=(obj,allowed,name)=>{
  must(object(obj),`${name}: object required`);
  must(Object.keys(obj).every(k=>allowed.includes(k)),`${name}: unknown field (credentials and admission flags are forbidden)`);
};
export function resolveDeploymentPath(codeRoot,value) {
  must(text(value)&&!value.startsWith('~')&&!value.includes('${'), 'Use explicit absolute or code-root-relative paths; no shell expansion');
  return path.resolve(codeRoot,value);
}
export function validateDeploymentProfile(p) {
  keys(p,['schema','purpose','docker_context','sources','python_environments','storage','containers'],'profile');
  must(p.schema==='pss-sponsor-deployment-v1','Unsupported deployment profile');
  must(['local-diagnostic','sponsor-native-linux'].includes(p.purpose),'Explicit deployment purpose required');
  must(text(p.docker_context)&&!p.docker_context.startsWith('-'),'Explicit Docker context required');
  keys(p.sources,['wav','vwa','ata'],'sources');
  must(['wav','vwa','ata'].every(k=>text(p.sources[k])),'All three official source paths required');
  keys(p.python_environments,['wav','vwa','agentlab','browser_use'],'python_environments');
  for(const name of ['wav','vwa','agentlab','browser_use']) {
    const e=p.python_environments[name];keys(e,['executable','lock_file'],name);
    must(text(e.executable),'Explicit Python executable path required');
    must(e.lock_file===null||text(e.lock_file),'Explicit dependency lock path or null required');
  }
  keys(p.storage,['docker_filesystem_path','required_free_bytes','ledger_path','colima_profile'],'storage');
  if(p.storage.colima_profile!==undefined)must(p.purpose==='local-diagnostic'&&typeof p.storage.colima_profile==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,60}$/.test(p.storage.colima_profile),'Colima probe requires an explicit safe local diagnostic profile');
  must(p.storage.docker_filesystem_path===null||text(p.storage.docker_filesystem_path),'Docker filesystem path required or null');
  must(p.storage.required_free_bytes===null||(Number.isSafeInteger(p.storage.required_free_bytes)&&p.storage.required_free_bytes>0),'Storage requirement must be positive integer bytes or unknown/null');
  must(text(p.storage.ledger_path),'Dedicated local ledger directory required');
  must(Array.isArray(p.containers),'Explicit owned fixture inventory required');
  const seen=new Set();
  for(const c of p.containers) {
    keys(c,['name','benchmark','expected_image_digest'],'container');
    must(text(c.name)&&!c.name.startsWith('-')&&!seen.has(c.name),'Unique container name required');seen.add(c.name);
    must(['wav','vwa','ata'].includes(c.benchmark),'Unknown benchmark');
    must(/^sha256:[a-f0-9]{64}$/.test(c.expected_image_digest||''),'Immutable Docker image ID required, not a mutable tag');
  }
  return p;
}
export function readDeploymentProfile(filename,codeRoot) {
  const p=validateDeploymentProfile(JSON.parse(fs.readFileSync(filename,'utf8')));
  return {raw:p,resolved:{...p,
    sources:Object.fromEntries(Object.entries(p.sources).map(([k,v])=>[k,resolveDeploymentPath(codeRoot,v)])),
    python_environments:Object.fromEntries(Object.entries(p.python_environments).map(([k,e])=>[k,{executable:resolveDeploymentPath(codeRoot,e.executable),lock_file:e.lock_file===null?null:resolveDeploymentPath(codeRoot,e.lock_file)}])),
    storage:{...p.storage,docker_filesystem_path:p.storage.docker_filesystem_path===null?null:resolveDeploymentPath(codeRoot,p.storage.docker_filesystem_path),ledger_path:resolveDeploymentPath(codeRoot,p.storage.ledger_path)}}};
}
export function parseExactPins(contents) {
  const pins={};
  for(const line of contents.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('#'))) {
    const m=line.match(/^([A-Za-z0-9_.-]+)==([^\s;]+)$/);
    must(m,'Only exact name==version locks supported; resolve markers/direct URLs separately, never silently ignore them');
    const name=m[1].toLowerCase().replace(/[-_.]+/g,'-');
    must(!(name in pins),'Duplicate dependency pin');pins[name]=m[2];
  }
  must(Object.keys(pins).length>0,'Dependency lock cannot be empty');
  return pins;
}
export function indexInstalledDistributions(entries) {
  must(Array.isArray(entries),'Distribution inventory must preserve individual entries');
  const indexed=Object.create(null);
  for(const entry of entries) {
    must(Array.isArray(entry)&&entry.length===2,'Invalid distribution entry');
    const [rawName,version]=entry;
    must(typeof rawName==='string'&&/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(rawName)&&text(version)&&!/[\s;]/.test(version),'Invalid distribution name or version');
    const name=rawName.toLowerCase().replace(/[-_.]+/g,'-');
    must(!Object.hasOwn(indexed,name),'Duplicate normalized installed distribution');
    indexed[name]=version;
  }
  return indexed;
}
export function compareExactPins(pins,installed) {
  must(object(pins)&&object(installed),'Expected complete dependency maps');
  const expected=indexInstalledDistributions(Object.entries(pins));
  const actual=indexInstalledDistributions(Object.entries(installed));
  // Full set equality, including tooling packages. A matching subset is not a lock.
  return [...new Set([...Object.keys(expected),...Object.keys(actual)])].sort()
    .filter(name=>expected[name]!==actual[name])
    .map(name=>({name,expected:expected[name]??null,actual:actual[name]??null,
      reason:!Object.hasOwn(expected,name)?'unlocked':!Object.hasOwn(actual,name)?'missing':'version-mismatch'}));
}
export function inspectContainer(info,expectedDigest) {
  const bindings=Object.values(info?.HostConfig?.PortBindings||{}).flat().filter(Boolean);
  return {running:info?.State?.Running===true,image_matches:info?.Image===expectedDigest,
    loopback_only:info?.HostConfig?.NetworkMode!=='host'&&bindings.every(p=>['127.0.0.1','::1'].includes(p.HostIp)),
    health_status:info?.State?.Health?.Status??'not-declared'};
}
export function deploymentSummary(checks) {
  return {engineering_preflight_passed:checks.length>0&&checks.every(c=>c.status==='passed'),
    failed_checks:checks.filter(c=>c.status==='failed').map(c=>c.id),
    unverified_checks:checks.filter(c=>c.status==='unverified').map(c=>c.id),
    benchmark_admission:'not-established-by-deployment-doctor',confirmatory_authorized:false,
    model_requests:0,benchmark_executions:0};
}
