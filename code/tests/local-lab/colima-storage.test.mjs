import test from 'node:test';
import assert from 'node:assert/strict';
import {measureColimaStorage} from '../../local-lab/colima-storage.mjs';
const daemon={ID:'local-id',OSType:'linux',Architecture:'x86_64',DockerRootDir:'/var/lib/docker'};
const base=()=>({profile:'lab',home:'/test',context:{Name:'colima-lab',Endpoints:{docker:{Host:'unix:///test/.colima/lab/docker.sock'}}},daemon,requiredBytes:8192,
  run:(_cmd,args)=>args.includes('stat')?'4:4096':JSON.stringify(daemon)});
test('VM storage is measured on same daemon; low capacity is failed not unknown',()=>{
 assert.equal(measureColimaStorage(base()).available_bytes,'16384');
 assert.equal(measureColimaStorage({...base(),requiredBytes:16385}).passed,false);
});
test('remote socket, wrong profile or another daemon cannot provide capacity',()=>{
 assert.throws(()=>measureColimaStorage({...base(),profile:'../other'}));
 assert.throws(()=>measureColimaStorage({...base(),context:{Name:'colima-lab',Endpoints:{docker:{Host:'ssh://remote'}}}}));
 assert.throws(()=>measureColimaStorage({...base(),run:()=>JSON.stringify({...daemon,ID:'other'})}));
 assert.throws(()=>measureColimaStorage({...base(),run:()=>JSON.stringify({...daemon,DockerRootDir:'/different'})}));
});
test('reject command interpolation, missing reserve, invalid or zero block size',()=>{
 for(const root of ['/tmp/$(id)','/tmp/../docker',''])assert.throws(()=>measureColimaStorage({...base(),daemon:{...daemon,DockerRootDir:root}}));
 for(const requiredBytes of [null,0,-1,1.5])assert.throws(()=>measureColimaStorage({...base(),requiredBytes}));
 for(const raw of ['free:4096','4:0','1:2\n3:4'])assert.throws(()=>measureColimaStorage({...base(),run:(_c,a)=>a.includes('stat')?raw:JSON.stringify(daemon)}));
});
