import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const code=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const r=JSON.parse(fs.readFileSync(path.join(code,'artifacts/local-runtime/sponsor-readiness.json')));
// Whitelist public fields. No credentials, endpoint identifiers, raw logs, images, prompts or gold.
const report={kind:r.kind,observed_at:r.observed_at,host:r.host,checks:r.checks,
  provider:r.provider?{provider:r.provider.provider,model:r.provider.model,api:r.provider.api,configuration_sha256:r.provider.configuration_sha256}:null,
  infrastructure:r.infrastructure,offline_verification:r.offline_verification,
  execution_gate:r.execution_gate,adapter_capabilities:r.adapter_capabilities,benchmark_gates_snapshot:r.benchmark_gates_snapshot,
  only_api_key_missing:r.only_api_key_missing,ready_for_benchmark:r.ready_for_benchmark,live_gpt_verified:r.live_gpt_verified,
  confirmatory_authorized:false,model_requests:r.model_requests,benchmark_executions:r.benchmark_executions,
  limitations:r.limitations,source_sha256:r.source_sha256};
const dest=path.join(code,'../results/local-runtime',`${r.observed_at.slice(0,10)}-sponsor-readiness.json`);
fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({exported:path.basename(dest),ready_for_benchmark:report.ready_for_benchmark}));
