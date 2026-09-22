import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

test('real console exposes OpenAI config without key and refuses task launch even with diagnostic opt-in',async()=>{
  const socket=net.createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');
  const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'pss-sponsor-console-')),file=path.join(temp,'.env');
  const key='synthetic-private-config-only';
  fs.writeFileSync(file,`PSS_LOCAL_PROVIDER=openai\nOPENAI_MODEL=authorized-test-fixture\nOPENAI_API_KEY=${key}\nPSS_LOCAL_PORT=${port}\nPSS_LOCAL_ALLOW_DIAGNOSTIC_RUN=1\nPSS_SPEND_DB=${path.join(temp,'spend.sqlite')}\n`,{mode:0o600});
  const child=spawn(process.execPath,[fileURLToPath(new URL('../../console/server.mjs',import.meta.url))],{
    env:{...process.env,PSS_LOCAL_ENV_FILE:file},stdio:['ignore','pipe','pipe']});
  const exited=once(child,'exit');
  let browser;
  try {
    await Promise.race([once(child.stdout,'data'),exited.then(()=>{throw Error('Console exited before listening');}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Console start timeout')),8000);t.unref();})]);
    const origin=`http://127.0.0.1:${port}`;
    const stateRes=await fetch(`${origin}/api/state`),text=await stateRes.text(),state=JSON.parse(text);
    assert.doesNotMatch(text,new RegExp(key));assert.equal(state.provider,'openai');assert.equal(state.model,'authorized-test-fixture');
    assert.equal(state.provider_configuration.api,'responses');assert.equal(state.configured,true);
    assert.equal(state.execution_gate.allowed,false);
    assert.equal(state.spending.policy.cap_micro_cny,1500000000);
    assert.equal(state.spending.ready,false);
    assert.equal(state.study_design.protocol_id,'pss-manuscript-v2.1');assert.equal(state.study_design.configuration_count,19);
    assert.equal(state.development_acceptance.confirmatory_authorized,false);
    const accounting=await fetch(`${origin}/resource-accounting.mjs`);
    assert.equal(accounting.status,200);assert.match(accounting.headers.get('content-type'),/javascript/);
    browser=await chromium.launch({headless:true});
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin);
    await page.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('Local service online'));
    await page.waitForFunction(()=>document.querySelector('#metrics')?.textContent.includes('calls report usage'));
    assert.match(await page.locator('#development-coverage').innerText(),/Development acceptance/);
    assert.equal(await page.locator('#start').isDisabled(),true);
    assert.match(await page.locator('#spend-status').textContent(),/Pricing not ready/);
    assert.match(await page.locator('#spend-thresholds').textContent(),/1,425/);
    const denied=await fetch(`${origin}/api/budget/pause`,{method:'POST'});
    assert.equal(denied.status,403);
    await page.locator('#pause-spend').click();
    await page.waitForFunction(()=>document.querySelector('#spend-status').textContent.includes('Paused:'));
    assert.equal((await (await fetch(`${origin}/api/state`)).json()).spending.paused,true);
    await page.locator('#pause-spend').click();
    await page.waitForFunction(()=>document.querySelector('#spend-status').textContent.includes('Pricing not ready'));
    if(process.env.PSS_TEST_SCREENSHOT_DIR) {
      fs.mkdirSync(process.env.PSS_TEST_SCREENSHOT_DIR,{recursive:true});
      await page.setViewportSize({width:1440,height:1100});
      await page.screenshot({path:path.join(process.env.PSS_TEST_SCREENSHOT_DIR,'budget-desktop.png')});
    }
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.querySelector('#spending').getBoundingClientRect().right<=innerWidth),true);
    if(process.env.PSS_TEST_SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.PSS_TEST_SCREENSHOT_DIR,'budget-mobile.png'),fullPage:true});
    await page.route('**/api/state',route=>route.abort());
    await page.waitForFunction(()=>document.querySelector('#spend-status').textContent.includes('connection lost'));
    assert.equal(await page.locator('#pause-spend').isDisabled(),true);
    await page.unroute('**/api/state');
    await page.waitForFunction(()=>document.querySelector('#spend-status').textContent.includes('Pricing not ready'));
    assert.equal(await page.locator('#pause-spend').isDisabled(),false);
    assert.deepEqual(errors,[]);
    const result=await fetch(`${origin}/api/start`,{method:'POST',headers:{origin,'x-local-token':state.token}});
    assert.equal(result.status,409);assert.equal((await result.json()).execution_gate.allowed,false);
  } finally {await browser?.close();child.kill('SIGTERM');await exited;fs.rmSync(temp,{recursive:true});}
});
