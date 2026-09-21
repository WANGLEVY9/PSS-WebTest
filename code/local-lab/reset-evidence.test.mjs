import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {auditResetEvidence,resetProgress} from './reset-evidence.mjs';
const a='a'.repeat(64),b='b'.repeat(64),image='fixture-image';
const valid=()=>({kind:'ISOLATED_RESET_ENGINEERING_PREFLIGHT',status:'completed',state_reset_verified:true,
  final_container_stopped:true,expected_image:image,source_sha256:a,primary_before:a,primary_unchanged:true,
  primary_container_id:'neighbor',scope:'six review tables only',initial:{container_id:'c0',digest:a,site_status:200,base_urls_match:true},
  cycles:[1,2,3].map(n=>({cycle:n,old_container_id:`c${n-1}`,container_id:`c${n}`,digest:a,mutation_digest:b,
    mutation_detected:true,restored:true,primary_unchanged:true,site_status:200,base_urls_match:true}))});
test('three validated isolated cycles remain a scoped engineering proof, not task admission',()=>{
  const r=auditResetEvidence(valid(),image);assert.equal(r.verified,true);assert.equal(r.task_admission,false);assert.equal(r.confirmatory_authorized,false);
});
test('summary flag, incomplete cycles or identity/content/isolation drift cannot pass',()=>{
  for(const update of [r=>{r.cycles=[]},r=>{r.cycles[1].container_id='c0'},r=>{r.cycles[0].mutation_digest=a},
    r=>{r.cycles[2].digest=b},r=>{r.cycles[1].primary_unchanged=false},r=>{r.cycles[1].old_container_id='other'},
    r=>{r.final_container_stopped=false},r=>{r.status='running'}]) {
    const r=valid();update(r);assert.equal(auditResetEvidence(r,image).verified,false);
  }
  assert.equal(auditResetEvidence(valid(),'wrong-image').verified,false);
  assert.equal(auditResetEvidence(null,image).verified,false);
});
test('latest incomplete or unreadable report never falls back to an older passed report',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pss-reset-test-'));
  try {
    fs.writeFileSync(path.join(dir,'wav-reset-preflight-100.json'),JSON.stringify(valid()));
    fs.writeFileSync(path.join(dir,'wav-reset-preflight-200.json'),'incomplete');
    assert.equal(resetProgress(dir,image).status,'unreadable-latest-evidence');
    fs.writeFileSync(path.join(dir,'wav-reset-preflight-200.json'),JSON.stringify({...valid(),status:'running',cycles:[]}));
    assert.equal(resetProgress(dir,image).audit.verified,false);
  } finally {fs.rmSync(dir,{recursive:true});}
});
test('captured executable must match its recorded hash even when all cycles claim success',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pss-reset-source-test-'));
  try {
    const source='// synthetic test executable', r=valid();
    r.source_sha256=crypto.createHash('sha256').update(source).digest('hex');
    fs.writeFileSync(path.join(dir,'wav-reset-preflight-100.json'),JSON.stringify(r));
    assert.equal(resetProgress(dir,image).audit.verified,false);
    fs.writeFileSync(path.join(dir,'wav-reset-preflight-100.mjs'),source);
    assert.equal(resetProgress(dir,image).audit.verified,true);
    fs.writeFileSync(path.join(dir,'wav-reset-preflight-100.mjs'),'changed source');
    assert.equal(resetProgress(dir,image).audit.verified,false);
  } finally {fs.rmSync(dir,{recursive:true});}
});
