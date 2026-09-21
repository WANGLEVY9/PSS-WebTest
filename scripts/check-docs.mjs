#!/usr/bin/env node
// Dependency-free public presentation checks; no network or model calls.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=['README.md','README.zh-CN.md','CONTRIBUTING.md','SECURITY.md','CODE_OF_CONDUCT.md','CHANGELOG.md','code/README.md',
  ...fs.readdirSync(path.join(root,'docs')).filter(x=>x.endsWith('.md')).map(x=>`docs/${x}`)];
const errors=[];let links=0;
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const anchors=text=>{
  const counts=new Map(),out=new Set();let fenced=false;
  for(const line of text.split('\n')){
    if(/^\s*```/.test(line)){fenced=!fenced;continue;}
    if(fenced||!/^#{1,6} /.test(line))continue;
    const base=line.replace(/^#+ /,'').trim().toLowerCase().replace(/[^\p{L}\p{N}\p{M}_\- ]/gu,'').replace(/ /g,'-');
    const n=counts.get(base)||0;counts.set(base,n+1);out.add(base+(n?`-${n}`:''));
  }
  return out;
};
for(const file of files){
  const text=read(file);
  if(/\/Users\/|\/private\/tmp\//.test(text))errors.push(`${file}: developer-specific absolute path`);
  for(const [,target] of text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)){
    if(/^(https?:|mailto:)/.test(target))continue;
    const [rel,fragment]=target.split('#');
    const resolved=path.resolve(root,path.dirname(file),decodeURIComponent(rel||path.basename(file)));
    if(!resolved.startsWith(root+path.sep)){errors.push(`${file}: outside-repository link ${target}`);continue;}
    links++;
    if(!fs.existsSync(resolved)){errors.push(`${file}: missing ${target}`);continue;}
    if(fragment&&resolved.endsWith('.md')&&!anchors(fs.readFileSync(resolved,'utf8')).has(decodeURIComponent(fragment)))
      errors.push(`${file}: missing heading ${target}`);
  }
  const pkg=JSON.parse(read('code/package.json'));
  for(const [,command] of text.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g))
    if(!Object.hasOwn(pkg.scripts,command))errors.push(`${file}: unknown npm command ${command}`);
}
const active=JSON.parse(read('code/config/active-study-design.json'));
const design=JSON.parse(read(`code/config/${active.active_contract}`));
const tasks=design.benchmarks.reduce((sum,x)=>sum+x.selected_tasks,0);
const configs=design.models.length*design.agent_configurations_per_model.length+1;
const rounds=design.rounds.discovery.length+design.rounds.validation.length;
if(tasks*configs*rounds!==design.scale.scheduled_opportunities)errors.push('Active design scale does not reconcile');
const main=read('README.md'),zh=read('README.zh-CN.md');
for(const [file,text] of [['README.md',main],['README.zh-CN.md',zh]]){
  for(const value of [design.protocol_id,design.scale.scheduled_opportunities.toLocaleString('en-US')])
    if(!text.includes(value))errors.push(`${file}: stale active design value ${value}`);
}
const ata=design.benchmarks.find(x=>x.id==='ata');
if(ata.selected_tasks!==ata.expected_pass+ata.expected_fail)errors.push('ATA reference classes do not partition selected cases');
const metadata=JSON.parse(read('.github/repository-metadata.json'));
if(metadata.description.length>350)errors.push('GitHub description too long');
if(metadata.topics.length>20||metadata.topics.some(t=>!/^[a-z0-9][a-z0-9-]{0,49}$/.test(t)))errors.push('Invalid GitHub topics');
if(!fs.existsSync(path.join(root,metadata.social_preview)))errors.push('Missing social preview');
const cff=read('CITATION.cff');
if(!cff.includes('cff-version: 1.2.0')||!cff.includes('type: software'))errors.push('CFF identity fields missing');
// Full YAML/CFF schema validation is a separate release check; do not claim it here.
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(JSON.stringify({status:'PASS',markdown_files:files.length,local_links:links,active_protocol:design.protocol_id,
  planned_opportunities:tasks*configs*rounds,scope:'local links/headings, documented npm commands, design consistency, presentation metadata; no live execution or full CFF schema validation'},null,2));
