import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resetProgress } from './reset-evidence.mjs';

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
    'Resolve preregistered handling of reproduced answer-dependent native evaluator errors; no silent evaluator patch or exclusion',
    'Adapters beyond the exposed read-only retrieval development subset',
  ],
  visualwebarena:[
    'Per-task official site/fixture/asset dependencies, URL rewriting and login parity',
    'Digest-pinned deployment and three reset cycles; downloaded images alone do not pass',
    'VQA/LLM-judge runtime, native CLEAR action defects and torch wheel metadata discrepancy; base Python/browser installed only',
    'Official task reference-image delivery with hashes, distinct from live browser screenshots',
    'Three-arm adapter and replay evidence; DOM-derived SoM cannot enter the pixel-only arm',
  ],
  'autonomous-tester-agent-benchmark':[
    'Map the adopted 112 selected ATA task IDs and 56/56 classes to the pinned artifact with 113 parsed candidates; preserve exclusion/duplicate-step evidence, do not change the selected denominator to 113',
    'Local fixture/reset equivalence to published PASS/FAIL labels; do not dispatch upstream GitHub reset workflows',
    'Separate artifact-bundled evaluator from independently pinned PinATA checkout',
    'Live specification-only adapters and independent verdict/failed-step correctness checks',
  ],
};
const common=[
  'Recover and verify original two-reviewer eligibility/adjudication evidence; AI audit is not a replacement and missing local evidence does not establish global noncompletion',
  'Recover originally frozen included/excluded IDs and development/measurement separation; do not fabricate a pre-outcome freeze after collection',
  'Blinded Traditional authoring, two semantic reviewers, engineering-cost and deployment-failure ledger',
  'Dynamic information-boundary audit of inputs AND control flow on every adapter',
  'Bind actual models/frameworks/prompts/budgets to adopted manuscript v2.0; fixed D1-D2 and V1-V10, with original collection provenance',
  'Explicit confirmatory authorization; high agent success is not a gate',
];
const ata=readJSON(path.join(code,'artifacts/local-runtime/ata-preparation/summary.json'));
const runtime=path.join(code,'artifacts/local-runtime');
const reset=resetProgress(runtime,manifest.mandatory_core.find(b=>b.id==='webarena-verified').environment.candidate_image.reference);
if(reset.audit?.verified) openGates['webarena-verified'][0]=
  'Extend the verified six-review-table reset proof to exact task dependencies and implement per-arm reset in the runner; no full fixture admission yet';
const lastPull=fs.readdirSync(runtime).filter(n=>/^vwa-pull-\d+\.json$/.test(n)).sort().at(-1);
const pull=lastPull?readJSON(path.join(runtime,lastPull)):null;
const preflight=readJSON(path.join(runtime,'preflight-summary.json'));
const resumption=readJSON(path.join(runtime,'local-resumption.json'));
const completedChecks={
  'webarena-verified':preflight?.wav?[
    `Native evaluator/response tests: ${preflight.wav.native_tests?.passed ?? 'unknown'} passed, ${preflight.wav.native_tests?.skipped ?? 'unknown'} skipped`,
    `Installed source comparison: ${preflight.wav.installed_source_files_compared} files, match=${preflight.wav.installed_matches_source}`,
    'Native null-schema error reproduced with synthetic wrong answers; preserved as unresolved',
    `Isolated reset: ${reset.completed_cycles ?? 'unknown'}/3 cycles; scoped evidence verified=${reset.audit?.verified === true}. No task admission.`,
    ...(resumption?.recovery ? [`Retained clone recovery: ${resumption.recovery.status}; homepage ${resumption.recovery.homepage?.status ?? 'unknown'} in ${resumption.recovery.homepage?.elapsed_ms ?? 'unknown'} ms. NOT fresh reset proof.`] : []),
  ]:[],
  visualwebarena:preflight?.vwa?[
    `Pinned native runtime: Python ${preflight.vwa.runtime?.python}, Playwright ${preflight.vwa.runtime?.playwright}, Chromium ${preflight.vwa.runtime?.chromium}`,
    `Synthetic components: ${preflight.vwa.synthetic_checks_passed}/${preflight.vwa.synthetic_checks_total}; official action tests: ${preflight.vwa.official_action_tests?.failures} failed (not suppressed)`,
    `VM capacity gate: ${preflight.vwa.capacity?.reason || 'unknown'}`,
  ]:[],
  'autonomous-tester-agent-benchmark':preflight?.ata?[
    `Native CSV parser: ${preflight.ata.official_parsed_candidates} candidates, six-file parity=${preflight.ata.six_csv_parser_parity}`,
    `Formula checks: ${preflight.ata.metric_parity?.defined_metric_comparisons} defined comparisons, ${preflight.ata.metric_parity?.mismatches?.length} mismatches; undefined-rate convention differs explicitly`,
  ]:[],
};
const report={kind:'BENCHMARK_CONFORMANCE_AUDIT',observed_at:new Date().toISOString(),
  confirmatory_authorized:false,authorization_capability:'none',
  manifest_sha256:sha(fs.readFileSync(path.join(code,'config/benchmark-artifact-manifest.v1.0.json'))),
  common_open_gates:common,
  preflight_evidence_observed_at:preflight?.observed_at||null,
  reset_preflight:reset,
  vwa_last_pull:pull?{job:pull.job,started:pull.started,finished:pull.finished,exit_code:pull.exit_code,error_code:pull.error_code}:null,
  benchmarks:manifest.mandatory_core.map(b=>({id:b.id,admitted:false,source:gitSource(b),
    official_reference:b.repository,published_artifact:b.published_artifact?.doi||null,
    open_gates:openGates[b.id],component_evidence:completedChecks[b.id],
    ...(b.id==='autonomous-tester-agent-benchmark'?{parsed_candidates:ata?.published_tasks??null,frozen_marker_inventory:b.task_artifact.source_record_count}:{}),
  })),
  local_images:[image('am1n3e/webarena-verified-shopping:latest'),image('jykoh/classifieds:latest'),image('mysql:8.1')],
  interpretation:'Source and image presence are observations, not reset/evaluator/fairness conformance. Missing evidence remains unresolved. Never infer readiness from method pass rates.'};
if (process.argv.includes('--write')) {
  fs.writeFileSync(path.join(code,'artifacts/local-runtime/benchmark-conformance.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(code,'../results/local-runtime/2026-09-21-benchmark-conformance.json'),JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report,null,2));
