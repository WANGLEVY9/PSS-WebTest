import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {readVwaProvisionProfile,assertVwaDaemon,validateVwaPullCapacity,vwaComposeInvocation} from './vwa-fixture-config.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
if (argv.length !== 3 || !['config','ps','pull','up'].includes(argv[0]) || argv[1] !== '--profile') {
  console.error('Usage: node experiment/prepare-vwa.mjs <config|ps|pull|up> --profile PRIVATE_JSON');
  process.exit(2);
}
const action = argv[0];
// No API credentials, ambient DOCKER_HOST or implicit environment selection.
const env = Object.fromEntries(['PATH','HOME','USER','TMPDIR','SYSTEMROOT','DOCKER_CONFIG','SSH_AUTH_SOCK'].filter(k => process.env[k]).map(k => [k,process.env[k]]));
const read = args => {
  const r = spawnSync('docker', args, {encoding:'utf8', env, timeout:30000, maxBuffer:4*1024*1024});
  if (r.status !== 0) throw Error('docker-probe-unavailable');
  return JSON.parse(r.stdout);
};
let receipt, output;
try {
  const loaded = readVwaProvisionProfile(path.resolve(argv[2]));
  const p = loaded.profile;
  const job = `vwa-${action}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  output = path.join(p.output_dir, `${job}.json`);
  receipt = {kind:'VWA_EXPLICIT_PROVISIONING',job,action,started:new Date().toISOString(),profile_sha256:loaded.profile_sha256,confirmatory_authorized:false};
  const [context] = read(['context','inspect',p.docker_context]);
  const daemon = read(['--context',p.docker_context,'info','--format','{{json .}}']);
  assertVwaDaemon(p,context,daemon);
  receipt.docker_context = p.docker_context;
  if (action === 'pull') {
    const manifests = {};
    for (const role of ['web','db']) manifests[role] = read(['--context',p.docker_context,'manifest','inspect','--verbose',p.images[role]]);
    receipt.capacity = validateVwaPullCapacity(p,context,daemon,manifests);
  }
  if (action === 'up') {
    for (const role of ['web','db']) {
      const [image] = read(['--context',p.docker_context,'image','inspect',p.images[role]]);
      if (image.Os !== 'linux' || image.Architecture !== 'amd64' || !image.RepoDigests?.includes(p.images[role])) throw Error('pinned-local-image-unavailable');
    }
  }
  // Revalidate fixture bytes immediately before deployment; never trust an old probe.
  if (readVwaProvisionProfile(path.resolve(argv[2])).profile_sha256 !== loaded.profile_sha256) throw Error('profile-changed-during-preflight');
  const invocation = vwaComposeInvocation(p,path.join(root,'vwa-classifieds.compose.yaml'),action);
  const log = path.join(p.output_dir, `${job}.log`);
  const fd = fs.openSync(log,'wx',0o600);
  let result;
  try { result = spawnSync(invocation.command,invocation.args,{stdio:['ignore',fd,fd],env:{...env,...invocation.env},timeout:600000}); }
  finally { fs.closeSync(fd); }
  Object.assign(receipt,{finished:new Date().toISOString(),exit_code:result.status,error_code:result.error?.code || null,private_log:log});
  fs.writeFileSync(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify({job,action,exit_code:result.status,receipt:output,confirmatory_authorized:false}));
  process.exitCode = result.status ?? 1;
} catch (error) {
  // Do not echo parser/file/daemon error text, which may contain secrets.
  const safe = /^[a-z][a-z0-9-]{1,100}$/.test(error.message) ? error.message : 'invalid-profile-or-runtime';
  if (receipt && output && !fs.existsSync(output)) fs.writeFileSync(output,JSON.stringify({...receipt,finished:new Date().toISOString(),exit_code:2,error_code:safe},null,2)+'\n',{flag:'wx',mode:0o600});
  console.error(JSON.stringify({status:'blocked',reason:safe,receipt:output || null,confirmatory_authorized:false}));
  process.exitCode = 2;
}
