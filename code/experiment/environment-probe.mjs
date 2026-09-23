import {officialShoppingServicesReady} from './provisioning-contract.mjs';

// A single provisioning request only AFTER native dependencies are healthy.
// This never runs inside an agent's observation/action loop.
export async function probeShoppingHttp({fetchImpl=fetch,site='http://localhost:7770/',
  controller='http://127.0.0.1:7771/status',now=Date.now}={}) {
  const r={controller_success:false,navigation_verified:false,site_status:null,services:null};
  try {
    const res=await fetchImpl(controller,{signal:AbortSignal.timeout(15000),redirect:'error'});
    const body=await res.json();r.services=body.details?.value?.services||null;
    r.controller_success=officialShoppingServicesReady(res.status,body);
    if(!r.controller_success) {r.failure_class='environment-services';return r;}
    const start=now();
    const page=await fetchImpl(site,{signal:AbortSignal.timeout(90000),redirect:'manual'});
    const html=await page.text();
    r.navigation_elapsed_ms=now()-start;r.site_status=page.status;
    r.navigation_verified=page.status===200 && /<html[\s>]/i.test(html) && !/Fatal error/i.test(html);
    r.homepage_bytes=Buffer.byteLength(html);
    if(!r.navigation_verified)r.failure_class='environment-homepage';
  } catch(e) {r.failure_class=/timeout|abort/i.test(e?.name)?'environment-timeout':'environment-network';}
  return r;
}
