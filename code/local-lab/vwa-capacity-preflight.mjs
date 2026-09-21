import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {imageCapacityGate,parseDfKilobytes} from './provisioning-contract.mjs';
const code=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function probeVwaCapacity() {
  let report={kind:'VWA_PROVISIONING_CAPACITY_PREFLIGHT',observed_at:new Date().toISOString(),
    confirmatory_authorized:false,reference:'jykoh/classifieds:latest',allowed:false};
  try {
    const run=(command,args)=>execFileSync(command,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000});
    const manifest=JSON.parse(run('docker',['manifest','inspect','--verbose',report.reference]));
    const layers=manifest.SchemaV2Manifest?.layers;
    if(!layers?.length || !manifest.Descriptor?.digest) throw Error('Expected a single-platform manifest');
    const compressed=layers.reduce((n,l)=>n+l.size,0);
    const available=parseDfKilobytes(run('colima',['ssh','--profile','webarena-x86','--','df','-Pk','/var/lib/docker']));
    report={...report,resolved_digest:manifest.Descriptor.digest,platform:manifest.Descriptor.platform,
      ...imageCapacityGate(compressed,available),
      policy:'2x compressed bytes is only a provisioning reserve; unpacked size and runtime working space still need validation. No image substitution or disk cleanup is performed.'};
  } catch(e) {report.reason='capacity-check-unavailable';report.error=e.name;}
  fs.writeFileSync(path.join(code,'artifacts/local-runtime/vwa-capacity-preflight.json'),JSON.stringify(report,null,2)+'\n');
  return report;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const report=probeVwaCapacity(); console.log(JSON.stringify(report,null,2));
  if(!report.allowed) process.exitCode=2;
}
