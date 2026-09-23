// One opt-in API request, metadata only. Does not rewrite a benchmark snapshot or failure class.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadRuntimeEnv} from './runtime-env.mjs';
import {auxiliaryProvider,triageEnvelope,triageFailure} from './model-routing.mjs';
const [batchId,recordId,...flags]=process.argv.slice(2);
if(!/^local-[\w-]+$/.test(batchId||'') || !recordId || flags.some(f=>f!=='--live')) throw Error('Usage: node experiment/triage-failure.mjs local-BATCH RECORD_ID [--live]');
const store=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../artifacts/local-runtime');
const raw=fs.readFileSync(path.join(store,batchId,'snapshot.json'));
const snapshot=JSON.parse(raw);
if(snapshot.status==='running' || snapshot.records.some(r=>!r.finished_at)) throw Error('Entire batch must finish before auxiliary triage');
const matches=snapshot.records.filter(r=>r.record_id===recordId);
if(matches.length!==1) throw Error('Unique record ID required');
const evidence=triageEnvelope(matches[0]);
if(!flags.includes('--live')) console.log(JSON.stringify({mode:'DRY_RUN',model_requests:0,evidence},null,2));
else {
  const result=await triageFailure(auxiliaryProvider(loadRuntimeEnv()),matches[0]);
  const report={...result,batch_id:batchId,record_id:recordId,source_snapshot_sha256:crypto.createHash('sha256').update(raw).digest('hex'),created_at:new Date().toISOString()};
  const file=path.join(store,batchId,`aux-triage-${crypto.randomUUID()}.json`);
  fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({kind:report.kind,model:report.provider_configuration.model,failure_class:report.failure_class,saved_to:file,changes_outcome:false}));
  if(report.failure_class) process.exitCode=2;
}
