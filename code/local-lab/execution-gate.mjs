import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// A diagnostic opt-in is permission to run, not proof of benchmark readiness.
// This adapter currently creates fresh browser contexts but does NOT restore
// the database per arm. Keep this capability false until reset is implemented.
export const ADAPTER_CAPABILITIES=Object.freeze({per_arm_state_reset:false});
export function executionGate({readiness,conformance,sourceCommit,now=Date.now()}={}) {
  const reasons=[];
  const benchmark=conformance?.benchmarks?.find(b=>b.id==='webarena-verified');
  if(readiness?.ready!==true || readiness?.navigation_verified!==true)
    reasons.push('Live environment and navigation checks are not verified');
  const at=Date.parse(readiness?.observed_at);
  if(!Number.isFinite(at) || now-at<0 || now-at>600000)
    reasons.push('Environment evidence is absent, future-dated or older than 10 minutes');
  if(!sourceCommit || benchmark?.source?.expected_commit!==sourceCommit ||
    benchmark?.source?.head!==sourceCommit || benchmark?.source?.tracked_clean!==true || benchmark?.source?.pin_matches!==true)
    reasons.push('Official source evidence does not match the selected pinned source');
  if(benchmark?.admitted!==true || !Array.isArray(benchmark?.open_gates) || benchmark.open_gates.length)
    reasons.push('Benchmark reset/evaluator/adapter admission gates remain open');
  if(!ADAPTER_CAPABILITIES.per_arm_state_reset)
    reasons.push('Current runner has no verified per-arm database reset; a fresh browser context is not reset');
  return {allowed:reasons.length===0,reasons,confirmatory_authorized:false,
    scope:'local-benchmark-execution',checked_at:new Date(now).toISOString()};
}
export function currentExecutionGate() {
  const root=path.dirname(fileURLToPath(import.meta.url));
  const read=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}};
  const store=path.resolve(root,'../artifacts/local-runtime');
  return executionGate({readiness:read(path.join(store,'benchmark-readiness.json')),
    conformance:read(path.join(store,'benchmark-conformance.json')),
    sourceCommit:read(path.join(root,'benchmark-selection.json'))?.source_commit});
}
