import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { observePixels } from "./agent-protocol.mjs";

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
