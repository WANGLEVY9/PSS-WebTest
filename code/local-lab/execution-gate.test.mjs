import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {executionGate,ADAPTER_CAPABILITIES} from './execution-gate.mjs';
const now=Date.parse('2026-09-21T12:00:00Z');
const base={now,sourceCommit:'pin',readiness:{ready:true,navigation_verified:true,observed_at:new Date(now).toISOString()},
  conformance:{benchmarks:[{id:'webarena-verified',admitted:true,open_gates:[],source:{head:'pin',expected_commit:'pin',tracked_clean:true,pin_matches:true}}]}};
test('healthy website and even a claimed admission cannot supply missing runner reset',()=>{
  const g=executionGate(base);assert.equal(g.allowed,false);assert.equal(g.reasons.length,1);
  assert.match(g.reasons[0],/per-arm database reset/);assert.equal(g.confirmatory_authorized,false);
  assert.throws(()=>{ADAPTER_CAPABILITIES.per_arm_state_reset=true;});
});
test('missing, stale, changed and unadmitted evidence always fail closed',()=>{
  assert.equal(executionGate({now}).allowed,false);
  for(const observed_at of ['invalid',new Date(now-600001).toISOString(),new Date(now+1).toISOString()])
    assert.ok(executionGate({...base,readiness:{...base.readiness,observed_at}}).reasons.some(x=>/10 minutes/.test(x)));
  assert.ok(executionGate({...base,sourceCommit:'changed'}).reasons.some(x=>/pinned source/.test(x)));
  assert.ok(executionGate({...base,conformance:{}}).reasons.some(x=>/admission gates/.test(x)));
});
test('CLI checks admission before credentials or task export; API and UI use same decision',()=>{
  const runner=fs.readFileSync(new URL('./benchmark-runner.mjs',import.meta.url),'utf8');
  assert.ok(runner.indexOf('if (!admission.allowed)')<runner.indexOf('dotenv.config('));
  assert.match(fs.readFileSync(new URL('./server.mjs',import.meta.url),'utf8'),/if \(!admission.allowed\)/);
  assert.match(fs.readFileSync(new URL('./public/app.js',import.meta.url),'utf8'),/state\.execution_gate\?\.allowed !== true/);
});
