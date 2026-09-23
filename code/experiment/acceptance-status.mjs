// Read-only, explicitly published, hash-bound development coverage snapshot.
// Never authorizes a run. Never exposes private task bindings, gold or file paths.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function readAcceptanceStatus(store) {
  const unavailable={status:'not-published',confirmatory_authorized:false};
  const index=path.join(store,'acceptance-index.json');
  if(!fs.existsSync(index))return unavailable;
  try {
    const pointer=JSON.parse(fs.readFileSync(index,'utf8'));
    if(pointer.schema!=='pss-console-acceptance-pointer-v1'||!pointer.report?.file||!/^[a-f0-9]{64}$/.test(pointer.report.sha256))throw Error('pointer');
    const root=fs.realpathSync(store),file=fs.realpathSync(path.resolve(root,pointer.report.file));
    if(!file.startsWith(root+path.sep))throw Error('outside store');
    const bytes=fs.readFileSync(file);
    if(crypto.createHash('sha256').update(bytes).digest('hex')!==pointer.report.sha256)throw Error('drift');
    const r=JSON.parse(bytes);
    if(r.kind!=='DEVELOPMENT_TASK_COVERAGE_AUDIT'||r.confirmatory_authorized!==false||r.required_executions!==360||!Array.isArray(r.rows)||r.rows.length!==360)throw Error('report');
    for(const field of ['received_executions','evidence_ready_executions','fixture_ready_cells'])
      if(!Number.isSafeInteger(r[field])||r[field]<0)throw Error('counts');
    if(r.received_executions>360||r.evidence_ready_executions>r.received_executions||r.fixture_ready_cells>12)throw Error('counts');
    const profiles=['agentlab-visual','agentlab-hybrid','browser-use-hybrid','playwright'];
    const rows=r.rows.map(row=>{
      if(typeof row.task_key!=='string'||!profiles.includes(row.profile)||typeof row.evidence_ready!=='boolean'||!Array.isArray(row.errors))throw Error('row');
      return row;
    });
    if(rows.filter(x=>x.evidence_ready).length!==r.evidence_ready_executions)throw Error('summary drift');
    const benchmarks=['wav','vwa','ata'].map(b=>{
      const group=rows.filter(x=>x.task_key.startsWith(b+':'));
      if(group.length!==120)throw Error('coverage');
      return {benchmark:b,planned:120,ready:group.filter(x=>x.evidence_ready).length,
        profiles:profiles.map(p=>({profile:p,planned:30,ready:group.filter(x=>x.profile===p&&x.evidence_ready).length}))};
    });
    return {status:'published',campaign_id:String(r.campaign_id),host_id:String(r.host_id),
      candidate_version:String(r.candidate_version),published_at:String(pointer.published_at),
      report_sha256:pointer.report.sha256,planned:360,received:r.received_executions,
      evidence_ready:r.evidence_ready_executions,fixture_ready:r.fixture_ready_cells,
      delivery_evidence_ready:r.delivery_evidence_ready===true,benchmarks,
      confirmatory_authorized:false,note:'Evidence snapshot only. Lifecycle completion is not task success. Formal collection remains locked.'};
  } catch {return {status:'invalid-or-drifted',confirmatory_authorized:false};}
}
