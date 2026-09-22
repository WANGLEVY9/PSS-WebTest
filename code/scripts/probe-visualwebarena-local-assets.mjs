#!/usr/bin/env node
// Read-only inventory. Explicit Classifieds fixture profile; never infers admission.
import childProcess from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readVwaProvisionProfile,assertVwaDaemon} from '../local-lab/vwa-fixture-config.mjs';

const codeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const snapshotRoot = path.join(codeRoot,'artifacts','benchmark-snapshots','visualwebarena');
const expectedImages = {shopping:'shopping_final_0712',reddit:'postmill-populated-exposed-withimg'};

function defaultExecFile(command,args) {
  const env = Object.fromEntries(['PATH','HOME','USER','TMPDIR','SYSTEMROOT','DOCKER_CONFIG','SSH_AUTH_SOCK'].filter(k => process.env[k]).map(k => [k,process.env[k]]));
  return childProcess.execFileSync(command,args,{encoding:'utf8',env,stdio:['ignore','pipe','pipe'],timeout:15000,maxBuffer:4*1024*1024}).trim();
}

export function probeVisualWebArenaLocalAssets({execFile=defaultExecFile,root=snapshotRoot,provisionProfile=null,now=() => new Date().toISOString()}={}) {
  const assets = {shopping_image_present:false,reddit_image_present:false,classifieds_compose_present:false,homepage_source_present:false,reset_token_configured:false};
  const report = {schema_version:'2.0',kind:'visualwebarena-local-assets-probe',observed_at:now(),pinned_source_commit:'89f5af29305c3d1e9f97ce4421462060a70c9a03',
    docker_context:null,docker_architecture:null,docker_error:null,expected_images:expectedImages,images_observed:[],running_containers_observed:[],classifieds_compose_path:null,
    fixture_profile_valid:false,classifieds_image_digests_verified:false,assets,missing_assets:[],ready_for_service_start:false,study_execution_allowed:false,
    limitation:'Read-only inventory only. Legacy shopping/reddit image names are not immutable image provenance; task/reset/evaluator admission is separate.'};
  let loaded;
  try {
    if (!provisionProfile) throw Error('explicit-fixture-profile-required');
    loaded=readVwaProvisionProfile(path.resolve(provisionProfile));
  } catch (error) {
    report.classification='fixture-profile-blocked';
    report.reason=/^[a-z][a-z0-9-]{1,100}$/.test(error.message) ? error.message : 'invalid-fixture-profile';
    report.missing_assets=Object.keys(assets);
    return report; // No Docker call or source-directory fallback on invalid profile.
  }
  const p=loaded.profile;
  report.profile_sha256=loaded.profile_sha256;
  report.fixture_profile_valid=true;
  report.docker_context=p.docker_context;
  report.classifieds_compose_path=path.join(p.fixture_root,'docker-compose.yml');
  assets.classifieds_compose_present=true;
  assets.reset_token_configured=true;
  assets.homepage_source_present=fs.existsSync(path.join(root,'environment_docker','webarena-homepage','templates','index.html'));
  const run=args => execFile('docker',['--context',p.docker_context,...args]);
  try {
    const [context]=JSON.parse(execFile('docker',['context','inspect',p.docker_context]));
    const daemon=JSON.parse(run(['info','--format','{{json .}}']));
    assertVwaDaemon(p,context,daemon);
    report.docker_architecture=daemon.Architecture;
    report.images_observed=run(['images','--format','{{.Repository}}:{{.Tag}}']).split(/\r?\n/).filter(Boolean);
    report.running_containers_observed=run(['ps','--format','{{.Names}}\t{{.Image}}\t{{.Ports}}']).split(/\r?\n/).filter(Boolean);
    for (const [role,name] of Object.entries(expectedImages)) assets[`${role}_image_present`]=report.images_observed.some(x => x===name || x.startsWith(name+':'));
    report.classifieds_image_digests_verified=['web','db'].every(role => {
      const [image]=JSON.parse(run(['image','inspect',p.images[role]]));
      return image.Os==='linux' && image.Architecture==='amd64' && image.RepoDigests?.includes(p.images[role]);
    });
  } catch {
    report.docker_error='docker-inspection-unavailable-or-invalid'; // Never include raw daemon stderr.
  }
  report.missing_assets=Object.entries(assets).filter(([,present]) => !present).map(([name]) => name);
  report.classification=report.docker_error ? 'docker-inventory-blocked' : !report.classifieds_image_digests_verified ? 'pinned-classifieds-images-missing' : report.missing_assets.length ? 'official-assets-missing' : 'inventory-present-admission-unverified';
  return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url)===path.resolve(process.argv[1])) {
  const args=process.argv.slice(2);
  if (args.length!==2 || args[0]!=='--fixture-profile') {
    console.error('Usage: node scripts/probe-visualwebarena-local-assets.mjs --fixture-profile PRIVATE_JSON');
    process.exitCode=2;
  } else {
    const result=probeVisualWebArenaLocalAssets({provisionProfile:args[1]});
    console.log(JSON.stringify(result,null,2));
    // Inventory-only success never grants permission to provision or execute tasks.
    if (!result.fixture_profile_valid || result.docker_error || !result.classifieds_image_digests_verified || result.missing_assets.length) process.exitCode=2;
  }
}
