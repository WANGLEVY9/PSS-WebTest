// Public engineering evidence only: no credentials, paper text, screenshots, prompts or gold.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const code=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const report=JSON.parse(fs.readFileSync(path.join(code,'artifacts/local-runtime/sponsor-verification.json')));
const ledger=JSON.parse(fs.readFileSync(path.join(code,'artifacts/local-runtime/benchmark-validation.json')));
if(report.kind!=='SPONSOR_OFFLINE_VERIFICATION' || report.model_requests!==0 || report.benchmark_executions!==0) throw Error('Only offline verification may be exported here');
const out={kind:'ANALYSIS_ROUTING_ENGINEERING_VERIFICATION',started_at:report.started_at,finished_at:report.finished_at,
  passed:report.passed,model_requests:0,new_benchmark_executions:0,confirmatory_authorized:false,
  checks:report.checks.map(c=>({id:c.id,passed:c.passed,tests:c.tests,passed_tests:c.passed_tests,failed_tests:c.failed_tests,skipped_tests:c.skipped_tests,elapsed_ms:c.elapsed_ms,log_sha256:c.log_sha256})),
  source_files:report.source_files.map(s=>({file:s.file,sha256:s.sha256})),
  historical_ledger:{batches:ledger.batches.length,records:ledger.batches.reduce((n,b)=>n+b.records.length,0),errors:ledger.errors.length},
  boundaries:['Synthetic formula fixtures and mocked provider responses are not empirical runs.',
    'Candidate analysis does not amend the frozen plan or certify manuscript result provenance.',
    'Auxiliary annotations are provisional post-run metadata-only sidecars; the actor stays fixed.',
    'Benchmark reset, evaluator, human screening, framework and scheduler readiness remain separate gates.']};
const dest=path.join(code,'../results/local-runtime',`${report.started_at.slice(0,10)}-analysis-routing-verification.json`);
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(out,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({file:path.basename(dest),passed:out.passed,historical_ledger:out.historical_ledger,confirmatory_authorized:false}));
