import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {readAcceptanceStatus} from '../../experiment/acceptance-status.mjs';

test('acceptance UI cannot equate planned opportunities with executions or leak private fields',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pss-acceptance-ui-'));
  try {
    assert.equal(readAcceptanceStatus(root).status,'not-published');
    const rows=['wav','vwa','ata'].flatMap(b=>['agentlab-visual','agentlab-hybrid','browser-use-hybrid','playwright'].flatMap(p=>Array.from({length:30},(_,i)=>({task_key:b+':'+i,profile:p,evidence_ready:false,errors:['not-executed']}))));
    const report={kind:'DEVELOPMENT_TASK_COVERAGE_AUDIT',confirmatory_authorized:false,rows,
      required_executions:360,received_executions:0,evidence_ready_executions:0,fixture_ready_cells:0,
      secret:'PRIVATE_SENTINEL',private_path:'/private/secret',campaign_id:'unit-fixture'};
    const file=path.join(root,'coverage.json');
    function publish(){
      const raw=JSON.stringify(report);fs.writeFileSync(file,raw);
      fs.writeFileSync(path.join(root,'acceptance-index.json'),JSON.stringify({schema:'pss-console-acceptance-pointer-v1',
        report:{file:'coverage.json',sha256:crypto.createHash('sha256').update(raw).digest('hex')},published_at:'unit-fixture'}));
    }
    publish();let r=readAcceptanceStatus(root);
    assert.equal(r.planned,360);assert.equal(r.received,0);assert.equal(r.evidence_ready,0);
    assert.equal(r.confirmatory_authorized,false);assert.doesNotMatch(JSON.stringify(r),/PRIVATE_SENTINEL|private_path/);
    fs.appendFileSync(file,' ');assert.equal(readAcceptanceStatus(root).status,'invalid-or-drifted');
    report.evidence_ready_executions=1;publish();assert.equal(readAcceptanceStatus(root).status,'invalid-or-drifted');
    report.evidence_ready_executions=0;report.confirmatory_authorized=true;publish();assert.equal(readAcceptanceStatus(root).status,'invalid-or-drifted');
  } finally {fs.rmSync(root,{recursive:true});}
});
