import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Read-only observations; this utility deliberately cannot authorize collection.
const code=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(fs.readFileSync(path.join(code,'config/benchmark-artifact-manifest.v1.0.json')));
const snapshots=path.join(code,'artifacts/benchmark-snapshots');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sourceNames={'webarena-verified':'webarena-verified',visualwebarena:'visualwebarena','autonomous-tester-agent-benchmark':'pinata'};
function readJSON(file) { try { return JSON.parse(fs.readFileSync(file)); } catch { return null; } }
function gitSource(benchmark) {
  const source=path.join(snapshots,sourceNames[benchmark.id]);
  try {
    const run=args=>execFileSync('git',['-C',source,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000}).trim();
    const head=run(['rev-parse','HEAD']);
    const dirty=run(['status','--porcelain','--untracked-files=no']);
    return {expected_commit:benchmark.source_commit,head,tracked_clean:dirty==='',pin_matches:head===benchmark.source_commit};
  } catch { return {expected_commit:benchmark.source_commit,head:null,tracked_clean:null,pin_matches:false}; }
}
function image(name) {
  try {
    const [i]=JSON.parse(execFileSync('docker',['--context','colima-webarena-x86','image','inspect',name],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000}));
    return {reference:name,id:i.Id,repo_digests:i.RepoDigests,architecture:i.Architecture};
  } catch { return {reference:name,id:null,repo_digests:[],architecture:null}; }
}
const openGates={
  'webarena-verified':[
    'Three verified reset cycles and task-state fingerprints; browser context is insufficient',
    'Environment dependency closure for the frozen task set; only Shopping is presently integrated',
    'Native evaluator semantic edge-case audit, including answer-dependent null-schema errors',
    'Adapters beyond the exposed read-only retrieval development subset',
  ],
  visualwebarena:[
    'Per-task official site/fixture/asset dependencies, URL rewriting and login parity',
    'Digest-pinned deployment and three reset cycles; downloaded images alone do not pass',
    'Python 3.10/3.11 runtime and unchanged native evaluator dependencies, including VQA where applicable',
    'Official task reference-image delivery with hashes, distinct from live browser screenshots',
    'Three-arm adapter and replay evidence; DOM-derived SoM cannot enter the pixel-only arm',
  ],
  'autonomous-tester-agent-benchmark':[
    'Resolve 112 marker count versus 113 parsed headers and duplicate source step indices without changing frozen population silently',
    'Local fixture/reset equivalence to published PASS/FAIL labels; do not dispatch upstream GitHub reset workflows',
    'Separate artifact-bundled evaluator from independently pinned PinATA checkout',
    'Live specification-only adapters and independent verdict/failed-step correctness checks',
  ],
};
const common=[
  'Two independent human eligibility reviews and adjudication; AI audit is not a replacement',
  'Freeze included/excluded task IDs and development/confirmatory separation before arm outcomes',
  'Blinded Traditional authoring, two semantic reviewers, engineering-cost and deployment-failure ledger',
  'Dynamic information-boundary audit of inputs AND control flow on every adapter',
  'Freeze models/frameworks/prompts/budgets, pilot-derived repetition plan and analysis version',
  'Explicit confirmatory authorization; high agent success is not a gate',
];
const ata=readJSON(path.join(code,'artifacts/local-runtime/ata-preparation/summary.json'));
const runtime=path.join(code,'artifacts/local-runtime');
const lastPull=fs.readdirSync(runtime).filter(n=>/^vwa-pull-\d+\.json$/.test(n)).sort().at(-1);
const pull=lastPull?readJSON(path.join(runtime,lastPull)):null;
const report={kind:'BENCHMARK_CONFORMANCE_AUDIT',observed_at:new Date().toISOString(),
  confirmatory_authorized:false,authorization_capability:'none',
  manifest_sha256:sha(fs.readFileSync(path.join(code,'config/benchmark-artifact-manifest.v1.0.json'))),
  common_open_gates:common,
  vwa_last_pull:pull?{job:pull.job,started:pull.started,finished:pull.finished,exit_code:pull.exit_code,error_code:pull.error_code}:null,
  benchmarks:manifest.mandatory_core.map(b=>({id:b.id,admitted:false,source:gitSource(b),
    official_reference:b.repository,published_artifact:b.published_artifact?.doi||null,
    open_gates:openGates[b.id],
    ...(b.id==='autonomous-tester-agent-benchmark'?{parsed_candidates:ata?.published_tasks??null,frozen_marker_inventory:b.task_artifact.source_record_count}:{}),
  })),
  local_images:[image('am1n3e/webarena-verified-shopping:latest'),image('jykoh/classifieds:latest'),image('mysql:8.1')],
  interpretation:'Source and image presence are observations, not reset/evaluator/fairness conformance. Missing evidence remains unresolved. Never infer readiness from method pass rates.'};
if (process.argv.includes('--write')) {
  fs.writeFileSync(path.join(code,'artifacts/local-runtime/benchmark-conformance.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(code,'../results/local-runtime/2026-09-21-benchmark-conformance.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));
