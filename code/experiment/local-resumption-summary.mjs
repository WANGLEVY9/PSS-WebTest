import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {currentExecutionGate} from './execution-gate.mjs';
const code=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), store=path.join(code,'artifacts/local-runtime');
const name=fs.readdirSync(store).filter(n=>/^wav-recovery-\d+\.json$/.test(n)).sort().at(-1);
const r=name?JSON.parse(fs.readFileSync(path.join(store,name))):null;
const batches=fs.readdirSync(store).filter(n=>n.startsWith('local-benchmark-'))
  .map(n=>{try{return JSON.parse(fs.readFileSync(path.join(store,n,'snapshot.json')));}catch{return null;}}).filter(Boolean);
const report={kind:'LOCAL_GATE_RESUMPTION',observed_at:new Date().toISOString(),
  confirmatory_authorized:false,new_agent_executions:0,model_requests:0,
  historical_batches:batches.length,historical_records:batches.reduce((n,b)=>n+b.records.length,0),
  execution_gate:currentExecutionGate(),
  recovery:r?{artifact:name,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(store,name))).digest('hex'),
    status:r.status,polls:r.polls.length,services_ready:r.services_ready,homepage:r.homepage,
    state_reset_verified:r.state_reset_verified,stopped:r.stopped,finished_at:r.finished_at}:null,
  limitations:['Recovered retained clone, not fresh-image reset replication',
    'Dependency health and one longer warmup support an engineering diagnosis; do not isolate its sole causal contribution',
    'Three content-restoring reset cycles and runner per-arm reset remain unverified',
    'Provisioning wait changes do not change any agent decision, observation or budget',
    'VWA capacity gate and ATA fixture/population gates remain blocked; no other benchmark substituted'],
  regression:{local_node_tests:39,contract_tests:287,ata_preparation_tests:3,
    cli_negative_probe:'diagnostic opt-in still denied before credential loading or task export',
    api_negative_probe:'HTTP 409 with diagnostic opt-in and synthetic credentials; no task launched'}};
for(const p of [path.join(store,'local-resumption.json'),path.join(code,'../results/local-runtime/2026-09-21-local-resumption.json')])
  fs.writeFileSync(p,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
