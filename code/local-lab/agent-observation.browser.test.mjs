import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { observePixels, coordinateToPixels } from "./agent-protocol.mjs";

test("synthetic actuator calibration: normalized corners/center and signed CSS-pixel scroll", async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const viewport={width:1280,height:720};
    const page=await browser.newPage({viewport});
    // DOM assertions belong only to this synthetic actuator test; never agent input.
    await page.setContent('<body style="margin:0;height:5000px"><script>window.points=[];window.onclick=e=>window.points.push([e.clientX,e.clientY]);</script>');
    for (const [x,y] of [[0,0],[1000,0],[0,1000],[1000,1000],[500,500]]) {
      const p=coordinateToPixels(x,y,viewport);
      await page.mouse.click(p.x,p.y);
    }
    assert.deepEqual(await page.evaluate(()=>window.points),[[0,0],[1279,0],[0,719],[1279,719],[640,360]]);
    await page.mouse.wheel(0,500);
    await page.waitForFunction(()=>window.scrollY===500);
    await page.mouse.wheel(0,-300);
    await page.waitForFunction(()=>window.scrollY===200);
    await page.mouse.wheel(0,0);
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>window.scrollY),200);
  } finally { await browser.close(); }
});

test("real Chromium: legacy 600ms misses delayed content; pixel cadence observes it", async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1280,height:720}});
    await page.setContent('<body style="background:white"><button>Load reviews</button><script>document.querySelector("button").onclick=()=>setTimeout(()=>{document.body.style.background="navy";document.body.style.color="white";document.body.textContent="Synthetic loaded content";},1503);</script>');
    const capture = () => page.screenshot({type:"jpeg",quality:85,animations:"disabled"});
    await page.getByRole('button').click();
    await new Promise(r=>setTimeout(r,600));
    const early = await capture();
    const observed = await observePixels({capture,sleep:ms=>new Promise(r=>setTimeout(r,ms))});
    assert.notDeepEqual(early,observed.image);
    assert.deepEqual(observed.image,await capture());
    assert.ok(observed.elapsed_ms>=2000);
    assert.equal(observed.semantic_ready,null);
  } finally { await browser.close(); }
});
