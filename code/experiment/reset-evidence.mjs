import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const hash=x=>typeof x==='string' && /^[a-f0-9]{64}$/.test(x);
// Audit a narrow engineering proof, NEVER benchmark or task admission.
export function auditResetEvidence(r,expectedImage) {
  const reasons=[];
  if(!r || r.kind!=='ISOLATED_RESET_ENGINEERING_PREFLIGHT') reasons.push('Missing reset evidence');
  if(r?.status!=='completed' || r?.state_reset_verified!==true || r?.final_container_stopped!==true)
    reasons.push('Reset probe or final cleanup is incomplete');
  if(!expectedImage || r?.expected_image!==expectedImage || !hash(r?.source_sha256))
    reasons.push('Image/source binding missing or mismatched');
  if(!hash(r?.primary_before) || r?.primary_unchanged!==true || !r?.primary_container_id)
    reasons.push('Neighbor isolation evidence missing');
  const rows=r?.cycles;
  if(!Array.isArray(rows) || rows.length!==3) reasons.push('Exactly three completed cycles required');
  let previous=r?.initial?.container_id;
  const seen=new Set(previous?[previous]:[]), baseline=r?.initial?.digest;
  if(!previous || !hash(baseline) || r?.initial?.site_status!==200 || r?.initial?.base_urls_match!==true)
    reasons.push('Fresh baseline not verified');
  for(const [index,row] of (Array.isArray(rows)?rows:[]).entries()) {
    if(row.cycle!==index+1 || row.old_container_id!==previous || !row.container_id || seen.has(row.container_id) ||
      row.digest!==baseline || !hash(row.mutation_digest) || row.mutation_digest===baseline ||
      row.mutation_detected!==true || row.restored!==true || row.primary_unchanged!==true ||
      row.site_status!==200 || row.base_urls_match!==true) reasons.push(`Cycle ${index+1} content/identity/isolation mismatch`);
    previous=row.container_id;seen.add(previous);
  }
  return {verified:reasons.length===0,reasons,confirmatory_authorized:false,
    scope:r?.scope||'unknown',task_admission:false};
}

export function resetProgress(store,expectedImage) {
  let names;
  try {names=fs.readdirSync(store).filter(n=>/^wav-reset-preflight-\d+\.json$/.test(n)).sort();}
  catch {return {status:'unavailable',verified:false};}
  const file=names.at(-1);
  if(!file) return {status:'not-started',verified:false};
  try {
    const bytes=fs.readFileSync(path.join(store,file)), r=JSON.parse(bytes);
    const audit=auditResetEvidence(r,expectedImage);
    let capturedSourceVerified=false;
    try {capturedSourceVerified=crypto.createHash('sha256').update(fs.readFileSync(path.join(store,file.replace(/\.json$/,'.mjs')))).digest('hex')===r.source_sha256;} catch {}
    if(!capturedSourceVerified) {audit.verified=false;audit.reasons.push('Captured executable source does not match evidence hash');}
    return {artifact:file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),captured_source_verified:capturedSourceVerified,
      run_id:r.run_id,status:r.status,started_at:r.started_at,finished_at:r.finished_at||null,
      phase:r.events?.at(-1)?.phase||'unavailable',completed_cycles:r.cycles?.length??null,
      services:r.service_observations?.at(-1)?.services||null,
      homepage:r.homepage_observations?.at(-1)||null,
      audit};
  } catch {return {artifact:file,status:'unreadable-latest-evidence',verified:false};}
}
