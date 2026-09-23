import test from 'node:test';
import assert from 'node:assert/strict';
import {probeShoppingHttp} from '../../experiment/environment-probe.mjs';
const services=Object.fromEntries(['mysqld','elasticsearch','redis-server','php-fpm','nginx','cron','mailcatcher','env-ctrl'].map(n=>[n,'HEALTHY']));
test('unhealthy dependencies cause zero homepage requests',async()=>{
  let calls=0;
  const r=await probeShoppingHttp({fetchImpl:async()=>{calls++;return{status:200,json:async()=>({success:true,details:{value:{services:{}}}})};}});
  assert.equal(calls,1);assert.equal(r.navigation_verified,false);
});
test('single body-consuming warmup follows service health and cannot grant benchmark admission',async()=>{
  const urls=[];let bodyRead=false;
  const r=await probeShoppingHttp({fetchImpl:async(url,opts)=>{
    urls.push(url);assert.ok(opts.signal);
    if(url.endsWith('status'))return{status:200,json:async()=>({success:true,details:{value:{services}}})};
    assert.equal(url,'http://localhost:7770/');assert.equal(opts.redirect,'manual');return{status:200,text:async()=>{bodyRead=true;return'<html><body>fixture</body></html>';}};
  }});
  assert.equal(urls.length,2);assert.equal(bodyRead,true);assert.equal(r.navigation_verified,true);assert.equal(r.admitted,undefined);
});
test('redirects and broken HTML never pass the homepage gate',async()=>{
  for(const [status,html] of [[302,'<html>'],[200,'Fatal error'],[200,'OK']]) {
    const r=await probeShoppingHttp({fetchImpl:async url=>url.endsWith('status')
      ?{status:200,json:async()=>({success:true,details:{value:{services}}})}:{status,text:async()=>html}});
    assert.equal(r.navigation_verified,false);
  }
});
