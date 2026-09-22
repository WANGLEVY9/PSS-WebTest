// Read-only VM capacity probe. Never substitutes host free disk or authorizes pulls.
import os from 'node:os';
import path from 'node:path';
const requireFact=(value,message)=>{if(!value)throw Error(message);};
export function measureColimaStorage({profile,context,daemon,requiredBytes,run,home=os.homedir()}) {
  requireFact(typeof profile==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,60}$/.test(profile),'Invalid Colima profile');
  requireFact(Number.isSafeInteger(requiredBytes)&&requiredBytes>0,'Explicit provisioning reserve required');
  const endpoint='unix://'+path.join(home,'.colima',profile,'docker.sock');
  requireFact(context?.Name==='colima-'+profile&&context?.Endpoints?.docker?.Host===endpoint,'Colima context/socket mismatch');
  requireFact(daemon.OSType==='linux'&&['amd64','x86_64'].includes(daemon.Architecture),'Linux x86 daemon required');
  requireFact(typeof daemon.ID==='string'&&daemon.ID.length>0,'Docker identity required');
  requireFact(/^\/[A-Za-z0-9_./-]+$/.test(daemon.DockerRootDir||'')&&!daemon.DockerRootDir.split('/').includes('..'),'Unsafe or missing Docker root');
  const inside=JSON.parse(run('colima',['ssh','--profile',profile,'--','docker','info','--format','{{json .}}']));
  requireFact(inside.ID===daemon.ID&&inside.DockerRootDir===daemon.DockerRootDir&&inside.OSType===daemon.OSType&&inside.Architecture===daemon.Architecture,'VM daemon identity/root mismatch');
  const raw=run('colima',['ssh','--profile',profile,'--','stat','-f','-c','%a:%S',daemon.DockerRootDir]).trim();
  requireFact(/^\d+:\d+$/.test(raw),'Invalid VM stat result');
  const [blocks,size]=raw.split(':').map(BigInt);
  requireFact(size>0n,'Invalid filesystem block size');
  const free=blocks*size;
  return {passed:free>=BigInt(requiredBytes),available_bytes:String(free),required_bytes:requiredBytes,
    measurement:'colima-ssh-statfs-daemon-identity-bound',docker_root_dir:daemon.DockerRootDir,
    scope:'Current provisioning reserve only; not image expansion sufficiency, pull authorization or benchmark admission'};
}
