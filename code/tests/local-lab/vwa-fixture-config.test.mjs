import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {FIXTURE_FILES,readVwaProvisionProfile,assertVwaDaemon,validateVwaPullCapacity,vwaComposeInvocation} from '../../local-lab/vwa-fixture-config.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'pss-vwa-config-test-'));
  t.after(() => fs.rmSync(root,{recursive:true,force:true}));
  const files = path.join(root,'fixture'), output = path.join(root,'private-output');
  fs.mkdirSync(path.join(files,'mysql'),{recursive:true}); fs.mkdirSync(output);
  const hashes = {};
  for (const name of FIXTURE_FILES) {
    const content = Buffer.from(`SYNTHETIC_CONFIG_FIXTURE:${name}`);
    fs.writeFileSync(path.join(files,name),content);
    hashes[name] = crypto.createHash('sha256').update(content).digest('hex');
  }
  const credentials = path.join(root,'private.env');
  fs.writeFileSync(credentials,'PSS_VWA_CLASSIFIEDS_RESET_TOKEN=synthetic-test-token\nPSS_VWA_DB_PASSWORD=synthetic\n',{mode:0o600});
  const profile = {schema:'pss-vwa-provision-v1',docker_context:'sponsor-local',project_name:'pss-vwa-test',fixture_root:files,fixture_files:hashes,images:{web:`jykoh/classifieds@sha256:${'a'.repeat(64)}`,db:`mysql@sha256:${'b'.repeat(64)}`},credentials_file:credentials,output_dir:output,required_free_bytes:6*1024**3};
  const filename = path.join(root,'profile.json');
  const save = () => fs.writeFileSync(filename,JSON.stringify(profile));
  save();
  return {root,files,profile,filename,save};
}
const daemon = {OSType:'linux',Architecture:'x86_64',DockerRootDir:'/var/lib/docker'};
const context = {Name:'sponsor-local',Endpoints:{docker:{Host:'unix:///var/run/docker.sock'}}};
const manifests = {web:{Descriptor:{digest:`sha256:${'a'.repeat(64)}`,platform:{os:'linux',architecture:'amd64'}},SchemaV2Manifest:{layers:[{size:1024}]}},db:{Descriptor:{digest:`sha256:${'b'.repeat(64)}`,platform:{os:'linux',architecture:'amd64'}},SchemaV2Manifest:{layers:[{size:1024}]}}};
const native = {platform:'linux',architecture:'x64',statfs:() => ({bavail:100000000000n,bsize:1n})};

test('valid explicit fixture hashes and private configuration are accepted',t => {
  const f=fixture(t),loaded=readVwaProvisionProfile(f.filename);
  assert.equal(loaded.profile.docker_context,'sponsor-local');
  assert.match(loaded.profile_sha256,/^[a-f0-9]{64}$/);
  assert.equal(loaded.profile.PSS_VWA_DB_PASSWORD,undefined);
});
test('missing full fixture manifest is rejected',t => {
  const f=fixture(t);delete f.profile.fixture_files['mysql/init_db.sh'];f.save();
  assert.throws(() => readVwaProvisionProfile(f.filename),/complete-fixture-manifest-required/);
});
test('changed SQL bytes and extra auto-executed SQL are rejected',t => {
  const f=fixture(t);fs.writeFileSync(path.join(f.files,'mysql/extra.sql'),'unexpected');
  assert.throws(() => readVwaProvisionProfile(f.filename),/fixture-file-set-mismatch/);
  fs.unlinkSync(path.join(f.files,'mysql/extra.sql'));
  fs.appendFileSync(path.join(f.files,'mysql/init_db.sh'),'modified');
  assert.throws(() => readVwaProvisionProfile(f.filename),/fixture-hash-mismatch/);
});
test('symlinked fixture members are rejected',t => {
  const f=fixture(t);fs.symlinkSync(f.filename,path.join(f.files,'mysql/link.sql'));
  assert.throws(() => readVwaProvisionProfile(f.filename),/fixture-symlink-forbidden/);
});
test('fixture inside official snapshot directory is rejected',t => {
  const f=fixture(t),directory=path.join(f.root,'benchmark-snapshots','vwa');fs.mkdirSync(directory,{recursive:true});
  f.profile.fixture_root=directory;f.save();
  assert.throws(() => readVwaProvisionProfile(f.filename),/fixture-must-be-outside-official-source/);
});
test('latest/tag-only images are never admitted',t => {
  const f=fixture(t);f.profile.images.web='jykoh/classifieds:latest';f.save();
  assert.throws(() => readVwaProvisionProfile(f.filename),/immutable-image-digests-required/);
});
test('ambient-style credential directives and permissive key file modes are rejected',t => {
  const f=fixture(t);fs.appendFileSync(f.profile.credentials_file,'DOCKER_HOST=tcp://wrong\n');
  assert.throws(() => readVwaProvisionProfile(f.filename),/invalid-credential-file/);
  fs.chmodSync(f.profile.credentials_file,0o644);
  assert.throws(() => readVwaProvisionProfile(f.filename),/credentials-must-be-private-file/);
});
test('caller must provide explicit valid context and absolute paths',t => {
  const f=fixture(t);f.profile.docker_context='--host=evil';f.save();
  assert.throws(() => readVwaProvisionProfile(f.filename),/invalid-context-or-project/);
  f.profile.docker_context='sponsor-local';f.profile.fixture_root='relative';f.save();
  assert.throws(() => readVwaProvisionProfile(f.filename),/absolute-paths-required/);
});
test('context mismatch or wrong daemon architecture fails',t => {
  const f=fixture(t);
  assert.throws(() => assertVwaDaemon(f.profile,{...context,Name:'different'},daemon),/docker-context-mismatch/);
  assert.throws(() => assertVwaDaemon(f.profile,context,{...daemon,Architecture:'aarch64'}),/linux-amd64-daemon-required/);
});
test('native exact-digest capacity evidence passes, no scientific authority implied',t => {
  const f=fixture(t),result=validateVwaPullCapacity(f.profile,context,daemon,manifests,native);
  assert.equal(result.compressed_bytes,2048);assert.equal(result.scope,'provisioning-only-not-scientific-admission');
});
test('Mac host or remote Docker disk cannot substitute for daemon free space',t => {
  const f=fixture(t);
  assert.throws(() => validateVwaPullCapacity(f.profile,context,daemon,manifests,{...native,platform:'darwin',architecture:'arm64'}),/native-local-storage/);
  assert.throws(() => validateVwaPullCapacity(f.profile,{...context,Endpoints:{docker:{Host:'ssh://remote'}}},daemon,manifests,native),/native-local-storage/);
});
test('digest mismatch, manifest lists, and insufficient space fail closed',t => {
  const f=fixture(t);
  assert.throws(() => validateVwaPullCapacity(f.profile,context,daemon,{...manifests,web:[]},native),/single-platform-image-manifest-required/);
  assert.throws(() => validateVwaPullCapacity(f.profile,context,daemon,{...manifests,web:manifests.db},native),/single-platform-image-manifest-required/);
  assert.throws(() => validateVwaPullCapacity(f.profile,context,daemon,manifests,{...native,statfs:() => ({bavail:1n,bsize:1n})}),/insufficient-docker-storage/);
});
test('Compose v2 gets explicit context, immutable images, no implicit build or pull',t => {
  const f=fixture(t),invocation=vwaComposeInvocation(f.profile,'/code/vwa.compose.yaml','up');
  assert.equal(invocation.command,'docker');assert.deepEqual(invocation.args.slice(0,3),['--context','sponsor-local','compose']);
  assert.deepEqual(invocation.args.slice(-5),['up','--pull','never','--no-build','--detach']);
  assert.equal(invocation.env.PSS_VWA_FIXTURE_MYSQL,path.join(f.files,'mysql'));
  assert.throws(() => vwaComposeInvocation(f.profile,'/code/vwa.compose.yaml','down'),/unsupported-action/);
});
test('legacy no-profile CLI fails before Docker or file mutation',t => {
  const f=fixture(t),before=fs.readdirSync(f.root);
  const cli=fileURLToPath(new URL('../../local-lab/prepare-vwa.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[cli,'config'],{cwd:f.root,encoding:'utf8',env:{PATH:'/nonexistent'}});
  assert.equal(result.status,2);assert.match(result.stderr,/--profile/);assert.deepEqual(fs.readdirSync(f.root),before);
});
