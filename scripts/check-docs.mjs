#!/usr/bin/env node
// Dependency-free public presentation checks; no network or model calls.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const markdownUnder=dir=>fs.readdirSync(path.join(root,dir),{withFileTypes:true})
  .flatMap(entry=>entry.isDirectory()?markdownUnder(`${dir}/${entry.name}`):
    entry.name.endsWith('.md')?[`${dir}/${entry.name}`]:[]);
// Dated receipts remain historical. Check the maintained operator entry points
// and all nested technical pages so newly added specifications cannot go dark.
const files=['README.md','README.zh-CN.md','CONTRIBUTING.md','SECURITY.md','CODE_OF_CONDUCT.md','code/README.md',
  ...markdownUnder('docs'),...markdownUnder('code/experiment/cloud-handoff'),
  ...['ANALYSIS-AND-ROUTING.md','SPEND-CONTROLS.md','ACCEPTANCE-RUNBOOK.md',
    'LIFECYCLE-AND-NATIVE-EVALUATION.md','SPONSOR-DEPLOYMENT.md']
    .map(file=>`code/docs/runbooks/${file}`),
  'code/experiment/README.md'];
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
if(tasks*configs*rounds!==design.scale.scheduled_opportunities)errors.push('Manuscript design scale does not reconcile');
const campaign=JSON.parse(read('code/config/current-campaign.json'));
const agentTotal=campaign.selected_task_count*campaign.models.length*campaign.agent_arms.length*campaign.rounds_per_task_configuration;
const baselineTotal=campaign.selected_task_count*campaign.rounds_per_task_configuration;
if(campaign.scope!=='planning-only'||campaign.benchmark!=='webarena-verified'||
  campaign.dispatcher_available!==false||campaign.confirmatory_authorized!==false||
  agentTotal!==campaign.planned_agent_executions||baselineTotal!==campaign.planned_baseline_executions||
  agentTotal+baselineTotal!==campaign.planned_total_executions)
  errors.push('Current WAV campaign plan is inconsistent');
const main=read('README.md'),zh=read('README.zh-CN.md');
for(const [file,text] of [['README.md',main],['README.zh-CN.md',zh]]){
  for(const value of [design.protocol_id,design.scale.scheduled_opportunities.toLocaleString('en-US')])
    if(!text.includes(value))errors.push(`${file}: stale manuscript design value ${value}`);
  if(!text.includes(String(campaign.planned_total_executions))||!text.includes('confirmatory_authorized=false'))
    errors.push(`${file}: current WAV planning status is missing`);
}
const ata=design.benchmarks.find(x=>x.id==='ata');
if(ata.selected_tasks!==ata.expected_pass+ata.expected_fail)errors.push('ATA reference classes do not partition selected cases');
// The public research page is the maintained design reference; keep its planned
// denominator reconciled with the active contract.
if(!read('docs/RESEARCH.md').includes(design.scale.scheduled_opportunities.toLocaleString('en-US')))
  errors.push('Stale planned denominator in docs/RESEARCH.md');
const inventory=JSON.parse(read('code/experiment/cloud-handoff/dependency-manifest.json'));
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const csv=fs.readFileSync(path.join(root,'code/experiment/cloud-handoff/dependency-packages.csv'));
if(sha(csv)!==inventory.inventory_sha256)errors.push('Cloud dependency inventory digest mismatch');
if(csv.toString('utf8').trimEnd().split('\n').length-1!==inventory.package_rows)errors.push('Cloud dependency inventory row count mismatch');
for(const input of inventory.dependency_inputs){
  // VWA requirements are external pinned-source bytes; their acquisition is
  // verified by export-dependencies.py, not falsely certified without assets.
  if(input.group==='vwa-upstream-declared')continue;
  const source=path.join(root,'code',input.source);
  if(!fs.existsSync(source)||sha(fs.readFileSync(source))!==input.sha256)
    errors.push(`Stale cloud dependency input: ${input.source}`);
}
if(inventory.cloud_install_verified!==false||inventory.confirmatory_authorized!==false)
  errors.push('Declared dependency inventory cannot authorize cloud installation or collection');
const metadata=JSON.parse(read('.github/repository-metadata.json'));
if(metadata.description.length>350)errors.push('GitHub description too long');
if(metadata.topics.length>20||metadata.topics.some(t=>!/^[a-z0-9][a-z0-9-]{0,49}$/.test(t)))errors.push('Invalid GitHub topics');
if(!fs.existsSync(path.join(root,metadata.social_preview)))errors.push('Missing social preview');
const cff=read('CITATION.cff');
if(!cff.includes('cff-version: 1.2.0')||!cff.includes('type: software'))errors.push('CFF identity fields missing');
// Full YAML/CFF schema validation is a separate release check; do not claim it here.
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(JSON.stringify({status:'PASS',markdown_files:files.length,local_links:links,current_campaign:campaign.campaign_id,current_planned_executions:campaign.planned_total_executions,
  manuscript_protocol:design.protocol_id,manuscript_planned_opportunities:tasks*configs*rounds,
  dependency_rows:inventory.package_rows,
  scope:'local links/headings, documented npm commands, design consistency, dependency inventory hashes, presentation metadata; no live execution, external-asset verification or full CFF schema validation'},null,2));
