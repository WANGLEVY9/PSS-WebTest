import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {probeVisualWebArenaLocalAssets} from '../../scripts/probe-visualwebarena-local-assets.mjs';
import {FIXTURE_FILES} from '../../local-lab/vwa-fixture-config.mjs';

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pss-vwa-inventory-test-'));
  t.after(() => fs.rmSync(root,{recursive:true,force:true}));
  const fixtureRoot=path.join(root,'fixture'),output=path.join(root,'private-output');
  fs.mkdirSync(path.join(fixtureRoot,'mysql'),{recursive:true});fs.mkdirSync(output);
  fs.mkdirSync(path.join(root,'environment_docker','webarena-homepage','templates'),{recursive:true});
  fs.writeFileSync(path.join(root,'environment_docker','webarena-homepage','templates','index.html'),'SYNTHETIC');
  const fixtureFiles={};
  for (const name of FIXTURE_FILES) {
    const content=Buffer.from('SYNTHETIC_INVENTORY:'+name);
    fs.writeFileSync(path.join(fixtureRoot,name),content);
    fixtureFiles[name]=crypto.createHash('sha256').update(content).digest('hex');
  }
  const credentials=path.join(root,'private.env');
  fs.writeFileSync(credentials,'PSS_VWA_CLASSIFIEDS_RESET_TOKEN=synthetic-test-token\nPSS_VWA_DB_PASSWORD=synthetic\n',{mode:0o600});
  const profile={schema:'pss-vwa-provision-v1',docker_context:'reviewed-context',project_name:'pss-vwa-test',fixture_root:fixtureRoot,fixture_files:fixtureFiles,images:{web:`jykoh/classifieds@sha256:${'a'.repeat(64)}`,db:`mysql@sha256:${'b'.repeat(64)}`},credentials_file:credentials,output_dir:output,required_free_bytes:6*1024**3};
  const filename=path.join(root,'profile.json');fs.writeFileSync(filename,JSON.stringify(profile));
  return {root,fixtureRoot,profile,filename};
}
function fakeExec(profile,{architecture='x86_64',throwSecret=false,digestMismatch=false}={}) {
  return (command,args) => {
    assert.equal(command,'docker');
    if (throwSecret) throw Error('DO_NOT_ECHO_PRIVATE_TOKEN');
    if (args[0]==='context') return JSON.stringify([{Name:profile.docker_context,Endpoints:{docker:{Host:'unix:///var/run/docker.sock'}}}]);
    assert.deepEqual(args.slice(0,2),['--context',profile.docker_context]);
    if (args[2]==='info') return JSON.stringify({OSType:'linux',Architecture:architecture,DockerRootDir:'/var/lib/docker'});
    if (args[2]==='images') return 'shopping_final_0712:latest\npostmill-populated-exposed-withimg:latest';
    if (args[2]==='ps') return '';
    if (args[2]==='image') return JSON.stringify([{Os:'linux',Architecture:'amd64',RepoDigests:digestMismatch ? [] : [args[4]]}]);
    throw Error('unexpected-command');
  };
}
test('no explicit fixture profile fails before any Docker call or legacy path fallback',() => {
  const result=probeVisualWebArenaLocalAssets({root:'/tmp/nonexistent-vwa-root',execFile:() => assert.fail('must not call Docker')});
  assert.equal(result.reason,'explicit-fixture-profile-required');
  assert.equal(result.ready_for_service_start,false);assert.equal(result.study_execution_allowed,false);
  assert.deepEqual(result.missing_assets,['shopping_image_present','reddit_image_present','classifieds_compose_present','homepage_source_present','reset_token_configured']);
});
test('explicit hash-verified independent fixture is inventoried under the selected context',t => {
  const f=fixture(t),result=probeVisualWebArenaLocalAssets({root:f.root,provisionProfile:f.filename,execFile:fakeExec(f.profile)});
  assert.equal(result.fixture_profile_valid,true);assert.equal(result.classifieds_image_digests_verified,true);
  assert.equal(result.assets.shopping_image_present,true);assert.equal(result.assets.reddit_image_present,true);
  assert.equal(result.classifieds_compose_path,path.join(fs.realpathSync(f.fixtureRoot),'docker-compose.yml'));
  assert.equal(result.classification,'inventory-present-admission-unverified');
  assert.equal(result.ready_for_service_start,false);assert.equal(result.study_execution_allowed,false);
});
test('tampered fixture is rejected before Docker inventory',t => {
  const f=fixture(t);fs.appendFileSync(path.join(f.fixtureRoot,'mysql/init_db.sh'),'tampered');
  const result=probeVisualWebArenaLocalAssets({root:f.root,provisionProfile:f.filename,execFile:() => assert.fail('must not call Docker')});
  assert.equal(result.reason,'fixture-hash-mismatch');assert.equal(result.fixture_profile_valid,false);
});
test('daemon error output is redacted',t => {
  const f=fixture(t),result=probeVisualWebArenaLocalAssets({root:f.root,provisionProfile:f.filename,execFile:fakeExec(f.profile,{throwSecret:true})});
  assert.equal(result.docker_error,'docker-inspection-unavailable-or-invalid');
  assert.equal(JSON.stringify(result).includes('DO_NOT_ECHO_PRIVATE_TOKEN'),false);
});
test('wrong architecture or missing pinned images cannot yield readiness',t => {
  const f=fixture(t);
  const wrong=probeVisualWebArenaLocalAssets({root:f.root,provisionProfile:f.filename,execFile:fakeExec(f.profile,{architecture:'aarch64'})});
  assert.equal(wrong.classification,'docker-inventory-blocked');
  const missing=probeVisualWebArenaLocalAssets({root:f.root,provisionProfile:f.filename,execFile:fakeExec(f.profile,{digestMismatch:true})});
  assert.equal(missing.classification,'pinned-classifieds-images-missing');assert.equal(missing.ready_for_service_start,false);
});
