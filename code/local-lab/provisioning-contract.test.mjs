import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeInitializerExited,assertDisposableInstance,imageCapacityGate,parseDfKilobytes,officialShoppingServicesReady} from './provisioning-contract.mjs';
test('homepage warmup requires every official dependency, not just MySQL or initializer exit',()=>{
  const services=Object.fromEntries(['mysqld','elasticsearch','redis-server','php-fpm','nginx','cron','mailcatcher','env-ctrl'].map(k=>[k,'HEALTHY']));
  const body={success:true,details:{value:{services}}};
  assert.equal(officialShoppingServicesReady(200,body),true);
  assert.equal(officialShoppingServicesReady(503,body),false);
  assert.equal(officialShoppingServicesReady(200,{success:true}),false);
  for(const name of Object.keys(services)) {
    assert.equal(officialShoppingServicesReady(200,{...body,details:{value:{services:{...services,[name]:'UNHEALTHY'}}}}),false);
  }
});
test('image provisioning checks VM space, not host free space or download timeout',()=>{
  assert.equal(imageCapacityGate(76861304894,9826464*1024).allowed,false);
  assert.equal(imageCapacityGate(76861304894,9826464*1024).reason,'below-compressed-size-lower-bound');
  assert.equal(imageCapacityGate(100,150).allowed,false);
  assert.equal(imageCapacityGate(100,250).allowed,true);
  for(const n of [null,NaN,-1,0,'100']) assert.equal(imageCapacityGate(n,1000).allowed,false);
  assert.equal(parseDfKilobytes('Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/vdb1 61609772 48621300 9826464 84% /var/lib/docker'),9826464*1024);
  assert.throws(()=>parseDfKilobytes('unexpected output'));
});
test('one-shot supervisor exit code 3 is not itself initializer failure',()=>{
  assert.equal(nativeInitializerExited(3,'env-ctrl-init EXITED Sep 21'),true);
  assert.equal(nativeInitializerExited(0,'env-ctrl-init RUNNING pid 1'),false);
  assert.equal(nativeInitializerExited(3,'env-ctrl-init FATAL failed'),false);
  assert.equal(nativeInitializerExited(137,'env-ctrl-init EXITED'),false);
  assert.equal(nativeInitializerExited(0,'other EXITED'),false);
});
test('lifecycle action rejects foreign containers, mounts, unknown image or missing provenance',()=>{
  const good={Config:{Labels:{'pss.preflight-run':'owned'}},Mounts:[],Image:'sha256:pinned'};
  assert.equal(assertDisposableInstance(good,'owned','sha256:pinned'),good);
  assert.throws(()=>assertDisposableInstance(good,'foreign','sha256:pinned'));
  assert.throws(()=>assertDisposableInstance({...good,Mounts:[{}]},'owned','sha256:pinned'));
  assert.throws(()=>assertDisposableInstance({...good,Image:'changed'},'owned','sha256:pinned'));
  assert.throws(()=>assertDisposableInstance({...good,Mounts:null},'owned','sha256:pinned'));
  assert.throws(()=>assertDisposableInstance(null,'owned','sha256:pinned'));
});
